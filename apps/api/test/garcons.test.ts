import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { AssignWaiterDto, CreateWaiterDto } from '../src/waiters/waiters.dto';
import { WaitersController } from '../src/waiters/waiters.controller';
import { WaitersService } from '../src/waiters/waiters.service';
import { controller, openOrder, prisma, resetDatabase, service } from './support/database';

const waiters = new WaitersService(prisma);
const waitersController = new WaitersController(waiters);

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

async function paidBy(table: number, price: number, waiterId: number | null, paidAt = '2026-11-16T15:00:00.000Z') {
  const { order } = await openOrder(table, 1, price);
  if (waiterId !== null) await waiters.assign(order.id, { waiterId });
  await service.closeOrder(order.id, { paymentMethod: 'PIX' });
  return prisma.order.update({ where: { id: order.id }, data: { paidAt: new Date(paidAt) } });
}

describe('RF-01 e RN-01: cadastro de garçons', () => {
  it('cria com comissão padrão de 10% e nome limpo', async () => {
    const waiter = await waitersController.create({ name: '  Ana Souza  ' });

    expect(waiter).toMatchObject({ name: 'Ana Souza', active: true });
    expect(waiter.commissionRate.toFixed(2)).toBe('10.00');
  });

  it('recusa nome repetido sem diferenciar maiúsculas e comissão acima de 30%', async () => {
    await waiters.create({ name: 'Bruno' });

    await expect(waiters.create({ name: 'BRUNO' })).rejects.toThrow('Já existe um garçom chamado Bruno.');
    await expect(waiters.create({ name: 'Carla', commissionRate: 31 })).rejects.toThrow('Informe a comissão de 0 a 30%');
  });

  it('lista ativos por padrão e todos quando pedido', async () => {
    const ana = await waiters.create({ name: 'Ana' });
    await waiters.create({ name: 'Bruno' });
    await waitersController.update(ana.id, { active: false });

    expect((await waitersController.list()).map((waiter) => waiter.name)).toEqual(['Bruno']);
    expect((await waitersController.list('true')).map((waiter) => waiter.name)).toEqual(['Ana', 'Bruno']);
  });

  it('edita nome e comissão, mantendo o próprio nome', async () => {
    const ana = await waiters.create({ name: 'Ana' });
    await waiters.create({ name: 'Bia' });

    const updated = await waiters.update(ana.id, { name: 'Ana', commissionRate: 12.5 });

    expect(updated.commissionRate.toFixed(2)).toBe('12.50');
    await expect(waiters.update(ana.id, { name: 'bia' })).rejects.toThrow('Já existe um garçom chamado Bia.');
  });

  it('RN-04: remove sem comandas; com comandas, pede para desativar', async () => {
    const livre = await waiters.create({ name: 'Livre' });
    const ocupado = await waiters.create({ name: 'Ocupado' });
    const { order } = await openOrder(1);
    await waiters.assign(order.id, { waiterId: ocupado.id });

    await expect(waitersController.remove(livre.id)).resolves.toEqual({ success: true });
    await expect(waiters.remove(ocupado.id)).rejects.toThrow('O garçom tem comandas registradas. Desative em vez de excluir.');
    await expect(waitersController.get(999)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RF-02 e RN-03: garçom da comanda', () => {
  it('CA-01: atribui guardando nome e taxa, e troca enquanto a comanda está aberta', async () => {
    const ana = await waiters.create({ name: 'Ana', commissionRate: 10 });
    const bruno = await waiters.create({ name: 'Bruno', commissionRate: 8 });
    const { order } = await openOrder(1);

    const first = await waitersController.assign(order.id, { waiterId: ana.id });
    expect(first).toMatchObject({ waiterId: ana.id, waiterName: 'Ana' });
    expect(first.commissionRate?.toFixed(2)).toBe('10.00');

    const second = await waiters.assign(order.id, { waiterId: bruno.id });
    expect(second).toMatchObject({ waiterId: bruno.id, waiterName: 'Bruno' });
    expect(second.commissionRate?.toFixed(2)).toBe('8.00');
  });

  it('CA-04: recusa comanda paga, comanda inexistente e garçom inativo', async () => {
    const ana = await waiters.create({ name: 'Ana' });
    const inativo = await waiters.create({ name: 'Inativo' });
    await waiters.update(inativo.id, { active: false });
    const { order } = await openOrder(1);

    await expect(waiters.assign(order.id, { waiterId: inativo.id })).rejects.toThrow('O garçom Inativo está inativo.');
    await expect(waiters.assign(999, { waiterId: ana.id })).rejects.toThrow('Comanda não encontrada.');
    await service.closeOrder(order.id, { paymentMethod: 'CASH' });
    await expect(waiters.assign(order.id, { waiterId: ana.id })).rejects.toThrow('Só comandas abertas podem trocar de garçom.');
  });
});

describe('RF-03: relatório por garçom', () => {
  it('CA-02: receita de cada garçom soma as comandas dele e o total é a receita do período', async () => {
    const ana = await waiters.create({ name: 'Ana', commissionRate: 10 });
    const bruno = await waiters.create({ name: 'Bruno', commissionRate: 5 });
    await paidBy(1, 100, ana.id);
    await paidBy(2, 50, ana.id);
    await paidBy(3, 300, bruno.id);
    await paidBy(4, 40, null);
    await paidBy(5, 999, ana.id, '2026-11-18T15:00:00.000Z');

    const report = await waitersController.report('2026-11-16', '2026-11-16');

    expect(report.waiters).toEqual([
      { waiterId: bruno.id, name: 'Bruno', paidOrders: 1, revenue: '300.00', averageTicket: '300.00', commission: '15.00' },
      { waiterId: ana.id, name: 'Ana', paidOrders: 2, revenue: '150.00', averageTicket: '75.00', commission: '15.00' },
      { waiterId: null, name: 'Sem garçom', paidOrders: 1, revenue: '40.00', averageTicket: '40.00', commission: '0.00' },
    ]);
    expect(report.totals).toEqual({ paidOrders: 4, revenue: '490.00', commission: '30.00' });
    expect((await controller.report('2026-11-16', '2026-11-16')).revenue).toBe(report.totals.revenue);
  });

  it('CA-03: mudar a comissão depois não muda o que já foi atribuído', async () => {
    const ana = await waiters.create({ name: 'Ana', commissionRate: 10 });
    await paidBy(1, 200, ana.id);
    await waiters.update(ana.id, { commissionRate: 20 });

    const report = await waiters.report(new Date('2026-11-16T00:00:00.000Z'), new Date('2026-11-17T00:00:00.000Z'));

    expect(report.waiters[0].commission).toBe('20.00');
  });

  it('recusa período inválido', () => {
    expect(() => waitersController.report('2026-11-17', '2026-11-16')).toThrow('A data inicial deve ser anterior ou igual à data final.');
  });
});

describe('validação dos dados de entrada', () => {
  async function invalidFields<T extends object>(dto: new () => T, body: Record<string, unknown>) {
    const errors = await validate(plainToInstance(dto, body), { whitelist: true, forbidNonWhitelisted: true });
    return errors.map((error) => error.property).sort();
  }

  it('cadastro e atribuição', async () => {
    expect(await invalidFields(CreateWaiterDto, { name: 'Ana', commissionRate: 12.5 })).toEqual([]);
    expect(await invalidFields(CreateWaiterDto, { name: 'A', commissionRate: 31 })).toEqual(['commissionRate', 'name']);
    expect(await invalidFields(AssignWaiterDto, { waiterId: 1 })).toEqual([]);
    expect(await invalidFields(AssignWaiterDto, { waiterId: 0 })).toEqual(['waiterId']);
  });
});
