import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { controller, openOrder, prisma, resetDatabase, service } from './support/database';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

type Method = 'CASH' | 'CREDIT' | 'DEBIT' | 'PIX';

// Abre uma comanda, fecha com a forma de pagamento e fixa a data do pagamento.
async function paidOrder(table: number, quantity: number, price: number, method: Method, paidAt: string) {
  const { order } = await openOrder(table, quantity, price);
  await service.closeOrder(order.id, { paymentMethod: method });
  return prisma.order.update({ where: { id: order.id }, data: { paidAt: new Date(paidAt) } });
}

describe('despesas', () => {
  it('registra despesa sem espaços sobrando e com a data informada', async () => {
    const expense = await controller.createExpense({
      description: '  Compra de farinha  ',
      amount: 87.4,
      incurredAt: '2026-11-10T12:00:00.000Z',
    });

    expect(expense.description).toBe('Compra de farinha');
    expect(expense.amount.toFixed(2)).toBe('87.40');
    expect(expense.incurredAt.toISOString()).toBe('2026-11-10T12:00:00.000Z');
  });

  it('usa a data de agora quando nenhuma data é informada', async () => {
    const before = Date.now();

    const expense = await service.createExpense({ description: 'Gás', amount: 120 });

    expect(expense.incurredAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it('recusa data de despesa inválida ao criar e ao editar', async () => {
    await expect(service.createExpense({ description: 'Gelo', amount: 10, incurredAt: 'ontem' })).rejects.toThrow(
      'Data da despesa inválida.',
    );
    const expense = await service.createExpense({ description: 'Gelo', amount: 10 });
    await expect(service.updateExpense(expense.id, { incurredAt: '31/02/2026' })).rejects.toThrow(
      'Data da despesa inválida.',
    );
  });

  it('RN-08: lista só as despesas do período, com a data final inclusiva', async () => {
    await service.createExpense({ description: 'Antes', amount: 1, incurredAt: '2026-10-31T23:59:00.000Z' });
    await service.createExpense({ description: 'Início', amount: 2, incurredAt: '2026-11-01T00:00:00.000Z' });
    await service.createExpense({ description: 'Fim', amount: 3, incurredAt: '2026-11-30T23:59:00.000Z' });
    await service.createExpense({ description: 'Depois', amount: 4, incurredAt: '2026-12-01T00:00:00.000Z' });

    const expenses = await controller.expenses('2026-11-01', '2026-11-30');

    expect(expenses.map((expense) => expense.description)).toEqual(['Fim', 'Início']);
  });

  it('edita só os campos enviados', async () => {
    const expense = await service.createExpense({ description: 'Luz', amount: 300, incurredAt: '2026-11-05' });

    const updated = await controller.updateExpense(expense.id, { amount: 315.2 });

    expect(updated.amount.toFixed(2)).toBe('315.20');
    expect(updated.description).toBe('Luz');
    expect(updated.incurredAt.toISOString()).toBe('2026-11-05T00:00:00.000Z');
  });

  it('remove despesa e avisa quando ela não existe', async () => {
    const expense = await service.createExpense({ description: 'Água', amount: 90 });

    await expect(controller.deleteExpense(expense.id)).resolves.toEqual({ success: true });
    await expect(service.deleteExpense(expense.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.updateExpense(expense.id, { amount: 1 })).rejects.toThrow('Despesa não encontrada.');
  });
});

describe('relatório financeiro', () => {
  it('RN-07: soma receita por forma de pagamento, subtrai despesas e respeita o período', async () => {
    await paidOrder(1, 2, 30, 'PIX', '2026-11-05T15:00:00.000Z');
    await paidOrder(2, 1, 45.5, 'CASH', '2026-11-30T23:30:00.000Z');
    await paidOrder(3, 1, 100, 'CREDIT', '2026-12-01T00:00:00.000Z');
    await service.createExpense({ description: 'Feira', amount: 20.25, incurredAt: '2026-11-10T08:00:00.000Z' });
    await service.createExpense({ description: 'Gelo', amount: 9.75, incurredAt: '2026-11-30T23:59:00.000Z' });
    await service.createExpense({ description: 'Outubro', amount: 500, incurredAt: '2026-10-31T23:59:00.000Z' });

    const report = await controller.report('2026-11-01', '2026-11-30');

    expect(report).toEqual({
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-12-01T00:00:00.000Z',
      paidOrders: 2,
      revenue: '105.50',
      expenses: '30.00',
      expenseCount: 2,
      balance: '75.50',
      payments: { CASH: '45.50', CREDIT: '0.00', DEBIT: '0.00', PIX: '60.00' },
    });
  });

  it('RN-07: ignora comandas abertas e canceladas', async () => {
    await paidOrder(1, 1, 10, 'DEBIT', '2026-11-15T12:00:00.000Z');
    await openOrder(2, 1, 50);
    const cancelled = await openOrder(3, 1, 70);
    await service.cancelOrder(cancelled.order.id);

    const report = await controller.report('2026-11-01', '2026-11-30');

    expect(report.paidOrders).toBe(1);
    expect(report.revenue).toBe('10.00');
    expect(report.payments.DEBIT).toBe('10.00');
  });

  it('período sem movimento devolve tudo zerado e saldo negativo quando só há despesa', async () => {
    const empty = await controller.report('2026-01-01', '2026-01-31');
    expect(empty).toMatchObject({ paidOrders: 0, revenue: '0.00', expenses: '0.00', balance: '0.00' });

    await service.createExpense({ description: 'Aluguel', amount: 1500, incurredAt: '2026-01-10T00:00:00.000Z' });
    const onlyExpense = await controller.report('2026-01-01', '2026-01-31');
    expect(onlyExpense.balance).toBe('-1500.00');
  });

  it('aceita relatório de um único dia', async () => {
    await paidOrder(1, 3, 5, 'PIX', '2026-11-20T23:59:59.000Z');

    const report = await controller.report('2026-11-20', '2026-11-20');

    expect(report.revenue).toBe('15.00');
  });
});

describe('RN-08: validação das datas do período', () => {
  it.each([
    ['formato errado', '2026-1-01', '2026-01-31'],
    ['dia que não existe', '2026-02-30', '2026-03-01'],
    ['data faltando', '2026-11-01', undefined],
    ['texto qualquer', 'hoje', 'amanhã'],
  ])('recusa %s', (_caso, from, to) => {
    expect(() => controller.report(from, to)).toThrow(BadRequestException);
    expect(() => controller.expenses(from, to)).toThrow('Informe datas válidas no formato AAAA-MM-DD.');
  });

  it('recusa data inicial depois da final', () => {
    expect(() => controller.report('2026-11-30', '2026-11-01')).toThrow(
      'A data inicial deve ser anterior ou igual à data final.',
    );
  });
});
