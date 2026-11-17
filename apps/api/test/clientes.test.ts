import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CustomersController } from '../src/customers/customers.controller';
import { AssignCustomerDto, CreateCustomerDto, UpdateCustomerDto } from '../src/customers/customers.dto';
import { CustomersService } from '../src/customers/customers.service';
import { OrderMovesService } from '../src/order-moves/order-moves.service';
import { openOrder, prisma, resetDatabase, service } from './support/database';

// Cadastro de clientes e histórico (SPEC/2026-11-16-clientes-e-historico.md). Nomes e números são fictícios.
const customers = new CustomersService(prisma);
const controller = new CustomersController(customers);
const moves = new OrderMovesService(prisma);

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

// Comanda paga na mesa, com o cliente ligado e a data de pagamento informada.
async function paidOrder(table: number, customerId: number | null, quantity: number, price: number, paidAt: string) {
  const { order } = await openOrder(table, quantity, price);
  if (customerId !== null) await customers.assignToOrder(order.id, { customerId });
  await service.closeOrder(order.id, { paymentMethod: 'PIX' });
  return prisma.order.update({ where: { id: order.id }, data: { paidAt: new Date(paidAt) } });
}

describe('T-01: histórico soma só as comandas pagas do cliente (CA-01)', () => {
  it('conta visitas, total, ticket médio, datas, itens preferidos e lista as comandas', async () => {
    const ana = await controller.create({ name: 'Ana Teste', phone: '(91) 90000-0001' });
    const bia = await customers.create({ name: 'Bia Teste' });

    const first = await paidOrder(1, ana.id, 2, 30, '2026-11-02T20:00:00.000Z');
    const second = await paidOrder(2, ana.id, 1, 45.5, '2026-11-10T21:00:00.000Z');
    await paidOrder(3, bia.id, 1, 99, '2026-11-11T21:00:00.000Z');
    await paidOrder(4, null, 1, 99, '2026-11-11T21:00:00.000Z');
    const { order: open } = await openOrder(5, 1, 10);
    await customers.assignToOrder(open.id, { customerId: ana.id });
    const { order: cancelled } = await openOrder(6, 1, 10);
    await customers.assignToOrder(cancelled.id, { customerId: ana.id });
    await service.cancelOrder(cancelled.id);

    const history = await controller.history(ana.id);
    expect(history).toMatchObject({
      customer: { id: ana.id, name: 'Ana Teste', phone: '91900000001' },
      period: null,
      visits: 2,
      totalSpent: '105.50',
      averageTicket: '52.75',
      firstVisit: new Date('2026-11-02T20:00:00.000Z'),
      lastVisit: new Date('2026-11-10T21:00:00.000Z'),
      favorites: [
        { name: 'Prato da mesa 1', quantity: 2 },
        { name: 'Prato da mesa 2', quantity: 1 },
      ],
    });
    expect(history.orders).toEqual([
      { id: second.id, paidAt: new Date('2026-11-10T21:00:00.000Z'), tableNumber: 2, total: '45.50' },
      { id: first.id, paidAt: new Date('2026-11-02T20:00:00.000Z'), tableNumber: 1, total: '60.00' },
    ]);
  });

  it('cliente sem compras tem histórico zerado e cliente inexistente dá 404', async () => {
    const ana = await customers.create({ name: 'Ana Teste' });
    expect(await customers.history(ana.id)).toMatchObject({ visits: 0, totalSpent: '0.00', orders: [] });
    await expect(customers.history(999)).rejects.toThrow(NotFoundException);
  });
});

describe('T-02: cadastro sem duplicar nome e telefone (CA-02)', () => {
  it('aceita cliente sem telefone e guarda os campos limpos', async () => {
    const created = await customers.create({ name: '  João   Conceição ', phone: '  ', notes: ' mesa na varanda ' });
    expect(created).toMatchObject({ name: 'João Conceição', nameKey: 'joao conceicao', phone: null, notes: 'mesa na varanda', active: true });
  });

  it('recusa o mesmo nome e telefone com outra grafia', async () => {
    await customers.create({ name: 'João Conceição', phone: '(91) 98888-7777' });
    await expect(customers.create({ name: 'JOAO  conceicao', phone: '+55 91 98888-7777' })).rejects.toThrow(
      new ConflictException('Já existe cliente com esse nome e telefone.'),
    );
    expect(await customers.create({ name: 'João Conceição', phone: '91 97777-6666' })).toMatchObject({ phone: '91977776666' });
  });

  it('dois clientes sem telefone e com o mesmo nome contam como duplicados', async () => {
    await customers.create({ name: 'Rosa' });
    await expect(customers.create({ name: 'rosa' })).rejects.toThrow('Já existe cliente com esse nome e telefone.');
  });

  it('dois cadastros iguais ao mesmo tempo gravam só um (RNF-01)', async () => {
    const results = await Promise.allSettled([
      customers.create({ name: 'Lia', phone: '9133334444' }),
      customers.create({ name: 'Lia', phone: '9133334444' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.customer.count()).toBe(1);
  });

  it('recusa nome, telefone e observação inválidos sem gravar', async () => {
    await expect(customers.create({ name: 'A' })).rejects.toThrow('Informe o nome do cliente, de 2 a 80 caracteres.');
    await expect(customers.create({ name: 'Ana', phone: '12345' })).rejects.toThrow('Informe o telefone com DDD, com 10 ou 11 dígitos.');
    await expect(customers.create({ name: 'Ana', notes: 'x'.repeat(301) })).rejects.toThrow('A observação deve ter até 300 caracteres.');
    expect(await prisma.customer.count()).toBe(0);
  });

  it('a edição muda só o que veio e também respeita a duplicidade', async () => {
    const ana = await customers.create({ name: 'Ana', phone: '9133334444', notes: 'vegetariana' });
    await customers.create({ name: 'Ana', phone: '9144445555' });

    const renamed = await controller.update(ana.id, { name: 'Ana Maria' });
    expect(renamed).toMatchObject({ name: 'Ana Maria', phone: '9133334444', notes: 'vegetariana', dedupeKey: 'ana maria|9133334444' });

    const cleared = await customers.update(ana.id, { phone: null, notes: null });
    expect(cleared).toMatchObject({ phone: null, notes: null, dedupeKey: 'ana maria|' });

    await expect(customers.update(ana.id, { name: 'ana', phone: '(91) 4444-5555' })).rejects.toThrow('Já existe cliente com esse nome e telefone.');
    await expect(customers.update(999, { name: 'X Y' })).rejects.toThrow(NotFoundException);
    expect(await controller.get(ana.id)).toMatchObject({ name: 'Ana Maria', phone: null });
  });
});

describe('T-03: busca (CA-03)', () => {
  it('acha por parte do nome sem acento e por parte do telefone, e esconde inativos', async () => {
    const joao = await customers.create({ name: 'João Conceição', phone: '91988887777' });
    const ines = await customers.create({ name: 'Inês Souza', phone: '9133334444' });
    const caio = await customers.create({ name: 'Caio Conceicao' });
    await customers.update(caio.id, { active: false });

    expect((await controller.list()).map((c) => c.id)).toEqual([ines.id, joao.id]);
    expect((await controller.list('CONCEI')).map((c) => c.id)).toEqual([joao.id]);
    expect((await controller.list('concei', 'true')).map((c) => c.id)).toEqual([caio.id, joao.id]);
    expect((await customers.list('3333')).map((c) => c.id)).toEqual([ines.id]);
    expect((await customers.list('(91) 98888')).map((c) => c.id)).toEqual([joao.id]);
    expect(await customers.list('ninguém')).toEqual([]);
    expect((await customers.list('   ')).map((c) => c.id)).toEqual([ines.id, joao.id]);
  });
});

describe('T-04: ligar e tirar cliente da comanda (CA-04)', () => {
  it('liga, troca e tira cliente de comanda aberta', async () => {
    const ana = await customers.create({ name: 'Ana' });
    const bia = await customers.create({ name: 'Bia' });
    const { order } = await openOrder(1);

    expect((await controller.assign(order.id, { customerId: ana.id })).customer).toMatchObject({ id: ana.id });
    const changed = await customers.assignToOrder(order.id, { customerId: bia.id });
    expect(changed.customerId).toBe(bia.id);
    expect(changed.items).toHaveLength(1);
    expect((await customers.assignToOrder(order.id, { customerId: null })).customer).toBeNull();
  });

  it('recusa comanda paga, cliente desativado e registros inexistentes', async () => {
    const ana = await customers.create({ name: 'Ana' });
    const off = await customers.create({ name: 'Sem Uso' });
    await customers.update(off.id, { active: false });
    const { order } = await openOrder(1);

    await expect(customers.assignToOrder(order.id, { customerId: off.id })).rejects.toThrow('Este cliente está desativado.');
    await expect(customers.assignToOrder(order.id, { customerId: 999 })).rejects.toThrow('Cliente não encontrado.');
    await expect(customers.assignToOrder(999, { customerId: ana.id })).rejects.toThrow('Comanda não encontrada.');

    await service.closeOrder(order.id, { paymentMethod: 'CASH' });
    await expect(customers.assignToOrder(order.id, { customerId: ana.id })).rejects.toThrow('Só comandas abertas podem mudar de cliente.');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).customerId).toBeNull();
  });
});

describe('T-05: período do histórico (CA-05)', () => {
  it('filtra pela data de pagamento, com a data final inclusiva', async () => {
    const ana = await customers.create({ name: 'Ana' });
    await paidOrder(1, ana.id, 1, 10, '2026-10-31T23:00:00.000Z');
    await paidOrder(2, ana.id, 1, 20, '2026-11-01T00:00:00.000Z');
    await paidOrder(3, ana.id, 1, 40, '2026-11-30T23:59:00.000Z');
    await paidOrder(4, ana.id, 1, 80, '2026-12-01T00:00:00.000Z');

    const november = await controller.history(ana.id, '2026-11-01', '2026-11-30');
    expect(november).toMatchObject({ period: { from: '2026-11-01', to: '2026-11-30' }, visits: 2, totalSpent: '60.00' });
    await expect(customers.history(ana.id, '2026-11-01')).rejects.toThrow('Informe datas válidas no formato AAAA-MM-DD.');
  });
});

describe('T-06: junção de comandas (CA-06)', () => {
  it('o destino sem cliente herda o da origem; com cliente, mantém o seu', async () => {
    const ana = await customers.create({ name: 'Ana' });
    const bia = await customers.create({ name: 'Bia' });

    const target = (await openOrder(1)).order;
    const source = (await openOrder(2)).order;
    await customers.assignToOrder(source.id, { customerId: ana.id });
    await moves.merge(target.id, { sourceOrderId: source.id, reason: 'Mesmo grupo' });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: target.id } })).customerId).toBe(ana.id);

    const keeps = (await openOrder(3)).order;
    const other = (await openOrder(4)).order;
    await customers.assignToOrder(keeps.id, { customerId: bia.id });
    await customers.assignToOrder(other.id, { customerId: ana.id });
    await moves.merge(keeps.id, { sourceOrderId: other.id, reason: 'Mesmo grupo' });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: keeps.id } })).customerId).toBe(bia.id);
  });
});

describe('validação das rotas', () => {
  it('confere os campos do cadastro, da edição e do vínculo', async () => {
    expect(await validate(plainToInstance(CreateCustomerDto, { name: ' Ana ', phone: '91 98888-7777' }))).toEqual([]);
    const badCreate = await validate(plainToInstance(CreateCustomerDto, { name: 'A', phone: 5, notes: 'x'.repeat(301) }));
    expect(badCreate.map((e) => e.property).sort()).toEqual(['name', 'notes', 'phone']);

    expect(await validate(plainToInstance(UpdateCustomerDto, {}))).toEqual([]);
    const badUpdate = await validate(plainToInstance(UpdateCustomerDto, { active: 'sim' }));
    expect(badUpdate.map((e) => e.property)).toEqual(['active']);

    expect(await validate(plainToInstance(AssignCustomerDto, { customerId: null }))).toEqual([]);
    expect(await validate(plainToInstance(AssignCustomerDto, { customerId: '3' }))).toEqual([]);
    const badAssign = await validate(plainToInstance(AssignCustomerDto, { customerId: 0 }));
    expect(badAssign.map((e) => e.property)).toEqual(['customerId']);
  });
});
