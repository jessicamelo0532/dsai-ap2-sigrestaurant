import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SalesReportsController } from '../src/sales-reports/sales-reports.controller';
import { SalesReportsService } from '../src/sales-reports/sales-reports.service';
import { controller, createMenuItem, createTable, prisma, resetDatabase, service } from './support/database';

const reports = new SalesReportsController(new SalesReportsService(prisma));

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

type Method = 'CASH' | 'CREDIT' | 'DEBIT' | 'PIX';

// Abre comanda na mesa, lança os itens, fecha e fixa a data do pagamento.
async function sell(table: number, lines: { menuItemId: number; quantity: number }[], method: Method, paidAt: string) {
  const { id } = await createTable(table);
  let orderId = 0;
  for (const line of lines) orderId = (await service.addOrderItem(id, line))!.id;
  await service.closeOrder(orderId, { paymentMethod: method });
  return prisma.order.update({ where: { id: orderId }, data: { paidAt: new Date(paidAt) } });
}

async function menu() {
  const tacaca = await createMenuItem({ name: 'Tacacá', category: 'Pratos', price: 18 });
  const suco = await createMenuItem({ name: 'Suco de cupuaçu', category: 'Bebidas', price: 9 });
  const pato = await createMenuItem({ name: 'Pato no tucupi', category: 'Pratos', price: 50 });
  return { tacaca, suco, pato };
}

describe('RF-01 a RF-06: relatório de vendas do período', () => {
  it('CA-01 e CA-02: só contas pagas entram e a receita bate com o relatório financeiro', async () => {
    const { tacaca, suco, pato } = await menu();
    await sell(1, [{ menuItemId: tacaca.id, quantity: 2 }, { menuItemId: suco.id, quantity: 2 }], 'PIX', '2026-11-16T15:30:00.000Z');
    await sell(2, [{ menuItemId: tacaca.id, quantity: 1 }, { menuItemId: pato.id, quantity: 1 }], 'CASH', '2026-11-16T15:59:00.000Z');
    await sell(3, [{ menuItemId: suco.id, quantity: 5 }], 'PIX', '2026-11-21T02:30:00.000Z');
    await sell(4, [{ menuItemId: pato.id, quantity: 3 }], 'DEBIT', '2026-11-22T12:00:00.000Z');
    const open = await createTable(5);
    await service.addOrderItem(open.id, { menuItemId: pato.id, quantity: 4 });
    const cancelled = await createTable(6);
    const toCancel = await service.addOrderItem(cancelled.id, { menuItemId: suco.id, quantity: 9 });
    await service.cancelOrder(toCancel!.id);

    const report = await reports.sales('2026-11-16', '2026-11-21');

    expect(report).toMatchObject({ paidOrders: 3, revenue: '167.00', itemsSold: 11, averageTicket: '55.67' });
    const financial = await controller.report('2026-11-16', '2026-11-21');
    expect(financial.revenue).toBe(report.revenue);
    expect(report.topByQuantity).toEqual([
      { name: 'Suco de cupuaçu', category: 'Bebidas', quantity: 7, revenue: '63.00', share: 37.7 },
      { name: 'Tacacá', category: 'Pratos', quantity: 3, revenue: '54.00', share: 32.3 },
      { name: 'Pato no tucupi', category: 'Pratos', quantity: 1, revenue: '50.00', share: 29.9 },
    ]);
    expect(report.topByRevenue[0].name).toBe('Suco de cupuaçu');
  });

  it('CA-03: categorias somam a receita e as faixas horárias cobrem todas as contas', async () => {
    const { tacaca, suco } = await menu();
    await sell(1, [{ menuItemId: tacaca.id, quantity: 1 }, { menuItemId: suco.id, quantity: 1 }], 'CREDIT', '2026-11-16T15:30:00.000Z');
    await sell(2, [{ menuItemId: suco.id, quantity: 2 }], 'PIX', '2026-11-16T23:30:00.000Z');

    const report = await reports.sales('2026-11-16', '2026-11-16');

    expect(report.byCategory).toEqual([
      { category: 'Bebidas', quantity: 3, revenue: '27.00', share: 60 },
      { category: 'Pratos', quantity: 1, revenue: '18.00', share: 40 },
    ]);
    expect(report.byHour.reduce((total, slot) => total + slot.orders, 0)).toBe(report.paidOrders);
    expect(report.byPayment.find((payment) => payment.method === 'CREDIT')).toEqual({ method: 'CREDIT', orders: 1, revenue: '27.00', share: 60 });
    expect(report.categoryByHour.find((row) => row.category === 'Bebidas')?.hours[20]).toBe('18.00');
  });

  it('CA-04: conta paga às 23h30 UTC entra na faixa das 20h e no dia de Belém', async () => {
    const { suco } = await menu();
    await sell(1, [{ menuItemId: suco.id, quantity: 1 }], 'PIX', '2026-11-17T01:30:00.000Z');

    const report = await reports.sales('2026-11-17', '2026-11-17');

    expect(report.byHour[22]).toEqual({ hour: 22, orders: 1, revenue: '9.00' });
    expect(report.byWeekday[1]).toEqual({ weekday: 1, label: 'segunda-feira', orders: 1, revenue: '9.00' });
  });

  it('CA-05: item removido do cardápio continua no ranking com categoria própria', async () => {
    const { pato } = await menu();
    await sell(1, [{ menuItemId: pato.id, quantity: 2 }], 'CASH', '2026-11-16T15:00:00.000Z');
    await service.deleteMenuItem(pato.id);

    const report = await reports.sales('2026-11-16', '2026-11-16');

    expect(report.topByQuantity).toEqual([
      { name: 'Pato no tucupi', category: 'Item removido do cardápio', quantity: 2, revenue: '100.00', share: 100 },
    ]);
  });

  it('limite do ranking', async () => {
    const { tacaca, suco, pato } = await menu();
    await sell(1, [{ menuItemId: tacaca.id, quantity: 3 }, { menuItemId: suco.id, quantity: 2 }, { menuItemId: pato.id, quantity: 1 }], 'PIX', '2026-11-16T15:00:00.000Z');

    const report = await reports.sales('2026-11-16', '2026-11-16', '2');

    expect(report.topByQuantity.map((item) => item.name)).toEqual(['Tacacá', 'Suco de cupuaçu']);
  });

  it('período sem vendas vem zerado', async () => {
    const report = await reports.sales('2026-01-01', '2026-01-31');

    expect(report).toMatchObject({ paidOrders: 0, revenue: '0.00', itemsSold: 0, averageTicket: '0.00', topByQuantity: [] });
  });

  it('CA-06: recusa datas inválidas, período invertido e limite fora de 1 a 50', () => {
    expect(() => reports.sales('16/11/2026', '2026-11-20')).toThrow('Informe datas válidas no formato AAAA-MM-DD.');
    expect(() => reports.sales('2026-11-20', '2026-11-16')).toThrow('A data inicial deve ser anterior ou igual à data final.');
    expect(() => reports.sales('2026-11-16', '2026-11-20', '51')).toThrow('Informe um limite de 1 a 50 itens.');
  });
});
