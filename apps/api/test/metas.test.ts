import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { GoalsController } from '../src/goals/goals.controller';
import { SetGoalDto } from '../src/goals/goals.dto';
import { GoalsService } from '../src/goals/goals.service';
import { openOrder, prisma, resetDatabase, service } from './support/database';

// Metas de vendas e comparativo (SPEC/2026-11-16-metas-de-vendas.md).
const clock = { now: new Date('2026-11-30T12:00:00.000Z') };
const at = (iso: string) => { clock.now = new Date(`${iso}.000Z`); };
const goals = new GoalsService(prisma, () => clock.now);
const controller = new GoalsController(goals);

beforeEach(async () => {
  await resetDatabase();
  at('2026-11-30T12:00:00');
});
afterAll(() => prisma.$disconnect());

let table = 0;
async function paid(price: number, paidAt: string, discount = 0) {
  table += 1;
  const { order } = await openOrder(table, 1, price);
  if (discount) await prisma.order.update({ where: { id: order.id }, data: { discount } });
  await service.closeOrder(order.id, { paymentMethod: 'PIX' });
  return prisma.order.update({ where: { id: order.id }, data: { paidAt: new Date(`${paidAt}.000Z`) } });
}

describe('T-01: cada mês usa a própria meta (CA-01)', () => {
  it('novembro e outubro calculam o atingimento com as metas certas', async () => {
    await controller.set('2026-10', { revenue: 600, orders: 4 });
    await controller.set('2026-11', { revenue: 300, averageTicket: 100 });
    await paid(100, '2026-10-05T15:00:00');
    await paid(200, '2026-10-20T15:00:00');
    await paid(150, '2026-11-03T15:00:00');
    await paid(150, '2026-11-10T15:00:00');

    const november = await controller.progress('2026-11');
    expect(november).toMatchObject({
      month: '2026-11',
      goal: { month: '2026-11', revenue: '300.00', orders: null, averageTicket: '100.00' },
      window: { from: '2026-11-01T00:00:00.000Z', to: '2026-11-30T12:00:00.000Z' },
      actual: { revenue: '300.00', orders: 2, averageTicket: '150.00' },
      attainment: { revenue: 100, orders: null, averageTicket: 150 },
      previous: { window: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-30T12:00:00.000Z' }, revenue: '300.00', orders: 2 },
      variation: { revenue: 0, orders: 0, averageTicket: 0 },
    });

    const october = await goals.progress('2026-10');
    expect(october).toMatchObject({
      window: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' },
      actual: { revenue: '300.00', orders: 2 },
      attainment: { revenue: 50, orders: 50, averageTicket: null },
      previous: { revenue: '0.00', orders: 0 },
      variation: { revenue: null, orders: null, averageTicket: null },
    });

    expect((await goals.progress('2026-09')).goal).toBeNull();
  });
});

describe('T-02: janelas de mesmo tamanho (CA-02)', () => {
  it('compara 7 dias com os 7 dias anteriores', async () => {
    await paid(150, '2026-11-03T15:00:00');
    await paid(150, '2026-11-10T15:00:00');
    await paid(50, '2026-11-15T23:00:00');
    await paid(999, '2026-11-16T00:00:00');
    await paid(999, '2026-11-01T23:59:00');

    expect(await controller.compare('2026-11-09', '2026-11-15')).toEqual({
      current: { window: { from: '2026-11-09T00:00:00.000Z', to: '2026-11-16T00:00:00.000Z' }, revenue: '200.00', orders: 2, averageTicket: '100.00' },
      previous: { window: { from: '2026-11-02T00:00:00.000Z', to: '2026-11-09T00:00:00.000Z' }, revenue: '150.00', orders: 1, averageTicket: '150.00' },
      variation: { revenue: 33.3, orders: 100, averageTicket: -33.3 },
    });
    await expect(goals.compare('2026-11-09')).rejects.toThrow('Informe datas válidas no formato AAAA-MM-DD.');
  });

  it('no dia 16 compara com o dia 1 a 16 do mês anterior', async () => {
    at('2026-11-16T12:00:00');
    await paid(40, '2026-10-16T11:00:00');
    await paid(60, '2026-10-16T13:00:00');
    await paid(80, '2026-11-16T11:00:00');
    await paid(70, '2026-11-16T13:00:00');

    const progress = await goals.progress('2026-11');
    expect(progress.window).toEqual({ from: '2026-11-01T00:00:00.000Z', to: '2026-11-16T12:00:00.000Z' });
    expect(progress.previous).toEqual({
      window: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-16T12:00:00.000Z' },
      revenue: '40.00',
      orders: 1,
      averageTicket: '40.00',
    });
    expect(progress.actual.revenue).toBe('80.00');
    expect(progress.variation.revenue).toBe(100);
  });

  it('mês futuro tem janela vazia', async () => {
    await paid(10, '2026-11-20T10:00:00');
    const future = await goals.progress('2026-12');
    expect(future.window).toEqual({ from: '2026-12-01T00:00:00.000Z', to: '2026-12-01T00:00:00.000Z' });
    expect(future.actual).toEqual({ revenue: '0.00', orders: 0, averageTicket: '0.00' });
    expect(future.previous.orders).toBe(0);
  });
});

describe('T-03: cadastro das metas (CA-03)', () => {
  it('cria, troca, tira uma meta, lista por ano e apaga', async () => {
    expect(await goals.set('2026-11', { revenue: 30000, orders: 600, averageTicket: 50 })).toEqual({
      month: '2026-11', revenue: '30000.00', orders: 600, averageTicket: '50.00',
    });
    expect(await goals.set('2026-11', { revenue: 35000, orders: null })).toEqual({
      month: '2026-11', revenue: '35000.00', orders: null, averageTicket: null,
    });
    await goals.set('2026-12', { orders: 700 });
    await goals.set('2027-01', { orders: 500 });

    expect((await controller.list('2026')).map((goal) => goal.month)).toEqual(['2026-11', '2026-12']);
    expect((await goals.list()).map((goal) => goal.month)).toEqual(['2026-11', '2026-12', '2027-01']);

    expect(await controller.remove('2026-12')).toEqual({ success: true });
    await expect(goals.remove('2026-12')).rejects.toThrow('Não há meta para este mês.');
    expect(await prisma.salesGoal.count()).toBe(2);
  });

  it('recusa mês, ano e metas inválidos', async () => {
    await expect(goals.set('2026-13', { orders: 1 })).rejects.toThrow('Informe o mês no formato AAAA-MM.');
    await expect(goals.set('2026-11', {})).rejects.toThrow('Informe pelo menos uma meta: receita, comandas ou ticket médio.');
    await expect(goals.set('2026-11', { revenue: 0 })).rejects.toThrow('Informe uma meta de receita válida.');
    await expect(goals.list('26')).rejects.toThrow('Informe o ano no formato AAAA.');
    await expect(goals.progress('novembro')).rejects.toThrow('Informe o mês no formato AAAA-MM.');
    expect(await prisma.salesGoal.count()).toBe(0);
  });
});

describe('T-04: o realizado usa o total com desconto e só comandas pagas (CA-04)', () => {
  it('ignora abertas e canceladas e desconta o desconto', async () => {
    await goals.set('2026-11', { revenue: 180 });
    await paid(100, '2026-11-05T10:00:00', 10);
    table += 1;
    await openOrder(table, 1, 500);
    table += 1;
    const { order } = await openOrder(table, 1, 500);
    await service.cancelOrder(order.id);

    const progress = await goals.progress('2026-11');
    expect(progress.actual).toEqual({ revenue: '90.00', orders: 1, averageTicket: '90.00' });
    expect(progress.attainment.revenue).toBe(50);
  });
});

describe('validação da rota', () => {
  it('confere os números da meta', async () => {
    expect(await validate(plainToInstance(SetGoalDto, { revenue: 100.5, orders: 3, averageTicket: null }))).toEqual([]);
    const bad = await validate(plainToInstance(SetGoalDto, { revenue: 'x', orders: 0, averageTicket: 1.005 }));
    expect(bad.map((e) => e.property).sort()).toEqual(['averageTicket', 'orders', 'revenue']);
  });
});
