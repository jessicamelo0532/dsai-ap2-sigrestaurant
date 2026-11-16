import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CashService } from '../src/cash/cash.service';
import { ClosingsService } from '../src/closings/closings.service';
import { CustomersService } from '../src/customers/customers.service';
import { LoyaltyController } from '../src/loyalty/loyalty.controller';
import { LoyaltySettingsDto, RedeemPointsDto } from '../src/loyalty/loyalty.dto';
import { LoyaltyService } from '../src/loyalty/loyalty.service';
import { OrderMovesService } from '../src/order-moves/order-moves.service';
import { SalesReportsService } from '../src/sales-reports/sales-reports.service';
import { WaitersService } from '../src/waiters/waiters.service';
import { createMenuItem, openOrder, prisma, resetDatabase, service } from './support/database';

// Programa de fidelidade (SPEC/2026-11-16-programa-de-fidelidade.md). Nomes são fictícios.
const loyalty = new LoyaltyService(prisma);
const controller = new LoyaltyController(loyalty);
const customers = new CustomersService(prisma);
const moves = new OrderMovesService(prisma);

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

type Method = 'CASH' | 'CREDIT' | 'DEBIT' | 'PIX';

// Abre comanda com cliente (opcional).
async function orderFor(customerId: number | null, table: number, quantity: number, price: number) {
  const opened = await openOrder(table, quantity, price);
  if (customerId !== null) await customers.assignToOrder(opened.order.id, { customerId });
  return opened;
}

async function pay(orderId: number, method: Method = 'PIX') {
  return service.closeOrder(orderId, { paymentMethod: method });
}

// Cliente com saldo: paga uma comanda de `reais` com a regra padrão (1 ponto por real).
async function customerWithPoints(reais: number, table = 90) {
  const customer = await customers.create({ name: `Cliente ${table}` });
  if (reais > 0) {
    const { order } = await orderFor(customer.id, table, 1, reais);
    await pay(order.id, 'CASH');
  }
  return customer;
}

describe('T-01: pontos ganhos pela regra configurada (CA-01)', () => {
  it('credita 45, 136 e nenhum ponto conforme a regra do momento do pagamento', async () => {
    const ana = await customers.create({ name: 'Ana' });
    expect(await controller.settings()).toEqual({ pointsPerReal: 1, centsPerPoint: 5, minRedeemPoints: 100 });

    const first = await orderFor(ana.id, 1, 1, 45.5);
    await pay(first.order.id);

    expect(await controller.updateSettings({ pointsPerReal: 3 })).toEqual({ pointsPerReal: 3, centsPerPoint: 5, minRedeemPoints: 100 });
    const second = await orderFor(ana.id, 2, 1, 45.5);
    await pay(second.order.id);

    await loyalty.updateSettings({ pointsPerReal: 0 });
    const third = await orderFor(ana.id, 3, 1, 45.5);
    await pay(third.order.id);

    const statement = await controller.customer(ana.id);
    expect(statement.balance).toBe(181);
    expect(statement.entries.map((e) => [e.type, e.points, e.orderId])).toEqual([
      ['EARN', 136, second.order.id],
      ['EARN', 45, first.order.id],
    ]);
    expect(await loyalty.getSettings()).toEqual({ pointsPerReal: 0, centsPerPoint: 5, minRedeemPoints: 100 });
  });

  it('comanda sem cliente não gera pontos', async () => {
    const { order } = await openOrder(1, 1, 80);
    await pay(order.id);
    expect(await prisma.loyaltyEntry.count()).toBe(0);
  });

  it('recusa regra inválida sem mudar a atual', async () => {
    await expect(loyalty.updateSettings({ centsPerPoint: 0 })).rejects.toThrow('Regra de fidelidade inválida: centsPerPoint.');
    expect(await loyalty.getSettings()).toEqual({ pointsPerReal: 1, centsPerPoint: 5, minRedeemPoints: 100 });
  });
});

describe('T-02: o resgate nunca deixa o total negativo (CA-02)', () => {
  it('desconta, recusa passar do subtotal e paga subtotal menos desconto', async () => {
    const ana = await customerWithPoints(200);
    const { table, order } = await orderFor(ana.id, 1, 1, 4);

    await expect(controller.redeem(order.id, { points: 100 })).rejects.toThrow(
      'O desconto de R$ 5,00 passa do total da comanda (R$ 4,00).',
    );

    const extra = await createMenuItem({ name: 'Suco', category: 'Bebidas', price: 3 });
    const withJuice = await service.addOrderItem(table.id, { menuItemId: extra.id, quantity: 1 });
    const juice = withJuice!.items.find((item) => item.menuItemId === extra.id)!;
    const first = withJuice!.items.find((item) => item.menuItemId !== extra.id)!;

    const redeemed = await controller.redeem(order.id, { points: 100 });
    expect(redeemed).toMatchObject({ subtotal: '7.00', discount: '5.00', total: '2.00', loyaltyPoints: 100, balance: 100 });

    await expect(service.removeOrderItem(order.id, first.id)).rejects.toThrow(
      'Desfaça o resgate de pontos antes: o desconto passaria do total da comanda.',
    );
    await expect(service.updateOrderItem(order.id, first.id, { quantity: 0 } as never)).rejects.toThrow(
      'Desfaça o resgate de pontos antes: o desconto passaria do total da comanda.',
    );
    await service.updateOrderItem(order.id, juice.id, { quantity: 2 });
    expect(await service.getOrder(order.id)).toMatchObject({ subtotal: '10.00', discount: '5.00', total: '5.00', loyaltyPoints: 100 });

    await pay(order.id);
    expect((await loyalty.customerLoyalty(ana.id)).balance).toBe(105);
  });

  it('não paga comanda com desconto maior que o subtotal (RN-10)', async () => {
    const ana = await customerWithPoints(0);
    const { order } = await orderFor(ana.id, 1, 1, 10);
    await prisma.order.update({ where: { id: order.id }, data: { discount: 12, loyaltyPoints: 240 } });
    await expect(pay(order.id)).rejects.toThrow('Desfaça o resgate de pontos antes: o desconto passaria do total da comanda.');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('OPEN');
  });
});

describe('T-03: saldo e extrato (CA-03)', () => {
  it('soma créditos, resgates e devoluções e mostra quanto o saldo vale', async () => {
    const ana = await customerWithPoints(240);
    const { order } = await orderFor(ana.id, 1, 1, 50);
    await loyalty.redeem(order.id, { points: 150 });
    await loyalty.undo(order.id);
    await loyalty.redeem(order.id, { points: 100 });

    const statement = await loyalty.customerLoyalty(ana.id);
    expect(statement).toMatchObject({ customerId: ana.id, balance: 140, balanceValue: '7.00' });
    expect(statement.entries.map((e) => [e.type, e.points])).toEqual([
      ['REDEEM', -100],
      ['REFUND', 150],
      ['REDEEM', -150],
      ['EARN', 240],
    ]);
    await expect(loyalty.customerLoyalty(999)).rejects.toThrow('Cliente não encontrado.');
  });
});

describe('T-04: desfazer e cancelar devolvem os pontos (CA-04)', () => {
  it('desfazer tira o desconto e devolve os pontos', async () => {
    const ana = await customerWithPoints(300);
    const { order } = await orderFor(ana.id, 1, 2, 25);
    await loyalty.redeem(order.id, { points: 200 });

    const undone = await controller.undo(order.id);
    expect(undone).toMatchObject({ subtotal: '50.00', discount: '0.00', total: '50.00', loyaltyPoints: 0, balance: 300 });
    await expect(loyalty.undo(order.id)).rejects.toThrow('Esta comanda não tem resgate de pontos.');
  });

  it('cancelar a comanda devolve os pontos resgatados', async () => {
    const ana = await customerWithPoints(300);
    const { order } = await orderFor(ana.id, 1, 2, 25);
    await loyalty.redeem(order.id, { points: 200 });
    expect((await loyalty.customerLoyalty(ana.id)).balance).toBe(100);

    await service.cancelOrder(order.id);

    expect((await loyalty.customerLoyalty(ana.id)).balance).toBe(300);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: 'CANCELLED', loyaltyPoints: 0 });
  });

  it('cancelar comanda sem resgate não mexe no extrato', async () => {
    const ana = await customerWithPoints(120);
    const { order } = await orderFor(ana.id, 1, 1, 10);
    await service.cancelOrder(order.id);
    expect(await prisma.loyaltyEntry.count()).toBe(1);
  });

  it('recusa resgate fora das regras, sem gravar nada', async () => {
    const ana = await customerWithPoints(150);
    const { order: anonymous } = await openOrder(1, 1, 50);
    await expect(loyalty.redeem(anonymous.id, { points: 100 })).rejects.toThrow('Ligue um cliente à comanda antes de resgatar pontos.');

    const { order } = await orderFor(ana.id, 2, 1, 50);
    await expect(loyalty.redeem(order.id, { points: 99 })).rejects.toThrow('Resgate pelo menos 100 pontos.');
    await expect(loyalty.redeem(order.id, { points: 151 })).rejects.toThrow('Saldo insuficiente: o cliente tem 150 pontos.');
    await loyalty.redeem(order.id, { points: 100 });
    await expect(loyalty.redeem(order.id, { points: 100 })).rejects.toThrow('Esta comanda já tem um resgate. Desfaça antes de resgatar de novo.');

    await pay(order.id);
    await expect(loyalty.redeem(order.id, { points: 100 })).rejects.toThrow('Só comandas abertas aceitam resgate de pontos.');
    await expect(loyalty.undo(order.id)).rejects.toThrow('Só comandas abertas aceitam resgate de pontos.');
    await expect(loyalty.redeem(999, { points: 100 })).rejects.toThrow('Comanda não encontrada.');
    expect((await loyalty.customerLoyalty(ana.id)).entries.map((e) => e.type)).toEqual(['EARN', 'REDEEM', 'EARN']);
  });

  it('com resgate, não troca o cliente nem junta a comanda como origem (RN-09)', async () => {
    const ana = await customerWithPoints(150);
    const bia = await customers.create({ name: 'Bia' });
    const { order } = await orderFor(ana.id, 1, 1, 50);
    const target = (await openOrder(2, 1, 20)).order;
    await loyalty.redeem(order.id, { points: 100 });

    await expect(customers.assignToOrder(order.id, { customerId: bia.id })).rejects.toThrow('Desfaça o resgate de pontos antes de trocar o cliente.');
    await expect(customers.assignToOrder(order.id, { customerId: null })).rejects.toThrow('Desfaça o resgate de pontos antes de trocar o cliente.');
    expect((await customers.assignToOrder(order.id, { customerId: ana.id })).customerId).toBe(ana.id);
    await expect(moves.merge(target.id, { sourceOrderId: order.id, reason: 'Mesmo grupo' })).rejects.toThrow(
      'Desfaça o resgate de pontos da comanda de origem antes de juntar.',
    );

    const merged = await moves.merge(order.id, { sourceOrderId: target.id, reason: 'Mesmo grupo' });
    expect(merged.items).toHaveLength(2);
    expect(await service.getOrder(order.id)).toMatchObject({ subtotal: '70.00', discount: '5.00', total: '65.00' });
  });
});

describe('T-05: resgates simultâneos (CA-05)', () => {
  it('dois resgates de 100 com saldo de 150 gastam só uma vez', async () => {
    const ana = await customerWithPoints(150);
    const first = await orderFor(ana.id, 1, 1, 20);
    const second = await orderFor(ana.id, 2, 1, 20);

    const results = await Promise.allSettled([
      loyalty.redeem(first.order.id, { points: 100 }),
      loyalty.redeem(second.order.id, { points: 100 }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason.message).toBe('Saldo insuficiente: o cliente tem 50 pontos.');
    expect((await loyalty.customerLoyalty(ana.id)).balance).toBe(50);
  });
});

describe('T-06: relatórios com o desconto (CA-06)', () => {
  it('financeiro, caixa, garçons, fechamento e histórico usam o total com desconto; vendas mostra o desconto à parte', async () => {
    const start = new Date('2000-01-01T00:00:00.000Z');
    const end = new Date('2100-01-01T00:00:00.000Z');
    const cash = new CashService(prisma, () => start);
    await cash.open({ operator: 'Caixa Teste', openingAmount: 0 });

    const ana = await customerWithPoints(200);
    const waiters = new WaitersService(prisma);
    const rita = await waiters.create({ name: 'Rita', commissionRate: 10 });
    const { order } = await orderFor(ana.id, 1, 1, 100);
    await waiters.assign(order.id, { waiterId: rita.id });
    await loyalty.redeem(order.id, { points: 100 });
    await pay(order.id, 'PIX');

    expect(await service.getOrder(order.id)).toMatchObject({ subtotal: '100.00', discount: '5.00', total: '95.00', loyaltyPoints: 100 });

    expect(await service.report(start, end)).toMatchObject({
      paidOrders: 2,
      revenue: '295.00',
      payments: { CASH: '200.00', CREDIT: '0.00', DEBIT: '0.00', PIX: '95.00' },
    });

    const shift = new CashService(prisma, () => end);
    expect((await shift.current())?.sales).toEqual({ CASH: '200.00', CREDIT: '0.00', DEBIT: '0.00', PIX: '95.00' });

    const byWaiter = await waiters.report(start, end);
    expect(byWaiter.waiters.find((row) => row.name === 'Rita')).toMatchObject({ revenue: '95.00', commission: '9.50' });

    const month = new Date().toISOString().slice(0, 7);
    expect((await new ClosingsService(prisma).getMonth(month)).dre).toMatchObject({ revenue: '295.00' });

    expect(await new SalesReportsService(prisma).report(start, end, 10)).toMatchObject({
      revenue: '300.00',
      discounts: '5.00',
      netRevenue: '295.00',
    });

    expect(await customers.history(ana.id)).toMatchObject({ visits: 2, totalSpent: '295.00' });
    expect((await loyalty.customerLoyalty(ana.id)).balance).toBe(195);
  });
});

describe('validação das rotas', () => {
  it('confere regra e pontos no corpo', async () => {
    expect(await validate(plainToInstance(LoyaltySettingsDto, {}))).toEqual([]);
    expect(await validate(plainToInstance(LoyaltySettingsDto, { pointsPerReal: 0, centsPerPoint: 1000, minRedeemPoints: 1 }))).toEqual([]);
    const badRule = await validate(plainToInstance(LoyaltySettingsDto, { pointsPerReal: 101, centsPerPoint: 0, minRedeemPoints: 1.5 }));
    expect(badRule.map((e) => e.property).sort()).toEqual(['centsPerPoint', 'minRedeemPoints', 'pointsPerReal']);

    const points = plainToInstance(RedeemPointsDto, { points: '150' });
    expect(await validate(points)).toEqual([]);
    expect(points.points).toBe(150);
    expect((await validate(plainToInstance(RedeemPointsDto, { points: 0 }))).map((e) => e.property)).toEqual(['points']);
  });
});
