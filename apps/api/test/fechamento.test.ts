import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CloseMonthDto, ReopenMonthDto } from '../src/closings/closings.dto';
import { ClosingsController } from '../src/closings/closings.controller';
import { ClosingsService } from '../src/closings/closings.service';
import { controller, openOrder, prisma, resetDatabase, service } from './support/database';
import { buy, purchasing, supplierNamed } from './support/purchasing';
import { ingredientWith } from './support/stock';

// "Hoje" é 16/11/2026: outubro e setembro já terminaram; novembro está em andamento.
const closings = new ClosingsService(prisma, () => new Date('2026-11-16T12:00:00.000Z'));
const closingsController = new ClosingsController(closings);

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

type Method = 'CASH' | 'CREDIT' | 'DEBIT' | 'PIX';

async function paidOrder(table: number, quantity: number, price: number, method: Method, paidAt: string) {
  const { order } = await openOrder(table, quantity, price);
  await service.closeOrder(order.id, { paymentMethod: method });
  return prisma.order.update({ where: { id: order.id }, data: { paidAt: new Date(paidAt) } });
}

// Outubro: duas contas pagas, duas despesas comuns e uma compra paga; setembro como mês anterior.
async function octoberWithSeptember() {
  await paidOrder(1, 2, 30, 'PIX', '2026-10-05T15:00:00.000Z');
  await paidOrder(2, 1, 45.5, 'CASH', '2026-10-31T23:30:00.000Z');
  await paidOrder(3, 1, 999, 'DEBIT', '2026-11-01T00:00:00.000Z');
  await paidOrder(4, 1, 100, 'PIX', '2026-09-10T12:00:00.000Z');
  await service.createExpense({ description: 'Feira', amount: 20.25, incurredAt: '2026-10-10T08:00:00.000Z' });
  await service.createExpense({ description: 'Gelo', amount: 9.75, incurredAt: '2026-10-31T23:59:00.000Z' });
  await service.createExpense({ description: 'Gás de setembro', amount: 50, incurredAt: '2026-09-20T08:00:00.000Z' });
  const supplier = await supplierNamed('Distribuidora Ver-o-Peso');
  const fish = await ingredientWith('Filhote', 0, 'KG');
  const acai = await ingredientWith('Açaí', 0, 'UN');
  const purchase = await buy(
    supplier.id,
    [
      { ingredientId: fish.id, quantity: 2.5, unitCost: 18.9 },
      { ingredientId: acai.id, quantity: 10, unitCost: 3.5 },
    ],
    { purchasedAt: '2026-10-15', dueDate: '2026-10-30' },
  );
  await purchasing.payPurchase(purchase.id, { paymentMethod: 'PIX', paidAt: '2026-10-20' });
}

describe('RF-01: DRE do mês', () => {
  it('CA-01: soma receita por forma, separa compras de outras despesas e bate com o relatório financeiro', async () => {
    await octoberWithSeptember();

    const october = await closingsController.month('2026-10');

    expect(october).toMatchObject({ month: '2026-10', label: '10/2026', status: 'OPEN', closing: null });
    expect(october.dre).toEqual({
      revenue: '105.50',
      payments: { CASH: '45.50', CREDIT: '0.00', DEBIT: '0.00', PIX: '60.00' },
      purchases: '82.25',
      otherExpenses: '30.00',
      expenses: '112.25',
      result: '-6.75',
      paidOrders: 2,
      averageTicket: '52.75',
    });
    const report = await controller.report('2026-10-01', '2026-10-31');
    expect(report).toMatchObject({ revenue: '105.50', expenses: '112.25', balance: '-6.75', paidOrders: 2 });
  });

  it('CA-02: traz o mês anterior e a variação de receita e de resultado', async () => {
    await octoberWithSeptember();

    const october = await closings.getMonth('2026-10');

    expect(october.previous).toMatchObject({ month: '2026-09', dre: { revenue: '100.00', result: '50.00' } });
    expect(october.variation).toEqual({ revenue: 5.5, result: -113.5 });
  });

  it('mês sem movimento e sem mês anterior: tudo zerado e sem variação', async () => {
    const empty = await closings.getMonth('2026-08');

    expect(empty.dre).toMatchObject({ revenue: '0.00', expenses: '0.00', result: '0.00', averageTicket: '0.00' });
    expect(empty.variation).toEqual({ revenue: null, result: null });
  });

  it('recusa mês em formato errado', async () => {
    await expect(closings.getMonth('10/2026')).rejects.toThrow('Informe o mês no formato AAAA-MM.');
  });
});

describe('RF-02 e RN-06: fechar o mês', () => {
  it('CA-03: guarda os valores da DRE, uma vez só', async () => {
    await octoberWithSeptember();

    const closed = await closingsController.close({ month: '2026-10', notes: '  Conferido com o caderno  ' });

    expect(closed).toMatchObject({ month: '2026-10', status: 'CLOSED', revision: 1, notes: 'Conferido com o caderno' });
    expect(closed.stored).toMatchObject({ revenue: '105.50', result: '-6.75', purchases: '82.25' });
    await expect(closings.close({ month: '2026-10' })).rejects.toThrow('O mês 10/2026 já está fechado.');
  });

  it('CA-03: não fecha o mês corrente nem meses futuros', async () => {
    await expect(closings.close({ month: '2026-11' })).rejects.toThrow('Só é possível fechar um mês que já terminou.');
    await expect(closings.close({ month: '2027-01' })).rejects.toThrow('Só é possível fechar um mês que já terminou.');
    expect(await prisma.monthlyClosing.count()).toBe(0);
  });

  it('lista os fechamentos do mais recente para o mais antigo', async () => {
    await closings.close({ month: '2026-09' });
    await closings.close({ month: '2026-10' });

    const list = await closingsController.list();

    expect(list.map((closing) => closing.month)).toEqual(['2026-10', '2026-09']);
    expect(list[0].label).toBe('10/2026');
  });
});

describe('RF-05 e RN-07: mês fechado não aceita lançamentos', () => {
  const message = 'O mês 10/2026 está fechado. Reabra o fechamento para alterar lançamentos desse mês.';

  it('CA-04: recusa criar, editar, mover e apagar despesa do mês fechado', async () => {
    const october = await service.createExpense({ description: 'Luz', amount: 300, incurredAt: '2026-10-05T12:00:00.000Z' });
    const november = await service.createExpense({ description: 'Água', amount: 90, incurredAt: '2026-11-05T12:00:00.000Z' });
    await closings.close({ month: '2026-10' });

    await expect(service.createExpense({ description: 'Atrasada', amount: 1, incurredAt: '2026-10-31T10:00:00.000Z' })).rejects.toThrow(message);
    await expect(controller.updateExpense(october.id, { amount: 1 })).rejects.toThrow(message);
    await expect(service.updateExpense(october.id, { incurredAt: '2026-11-02T10:00:00.000Z' })).rejects.toThrow(message);
    await expect(service.updateExpense(november.id, { incurredAt: '2026-10-02T10:00:00.000Z' })).rejects.toThrow(message);
    await expect(controller.deleteExpense(october.id)).rejects.toThrow(message);
    expect(await prisma.expense.count()).toBe(2);
    expect((await prisma.expense.findUniqueOrThrow({ where: { id: october.id } })).amount.toFixed(2)).toBe('300.00');
  });

  it('meses abertos continuam aceitando lançamentos', async () => {
    await closings.close({ month: '2026-10' });

    await expect(service.createExpense({ description: 'Gás', amount: 120, incurredAt: '2026-11-03T10:00:00.000Z' })).resolves.toBeTruthy();
    await expect(service.createExpense({ description: 'Setembro', amount: 10, incurredAt: '2026-09-03T10:00:00.000Z' })).resolves.toBeTruthy();
  });

  it('CA-04: recusa pagar compra com data de pagamento no mês fechado', async () => {
    const supplier = await supplierNamed();
    const fish = await ingredientWith('Filhote');
    const purchase = await buy(supplier.id, [{ ingredientId: fish.id, quantity: 1, unitCost: 30 }], {
      purchasedAt: '2026-10-15',
      dueDate: '2026-11-30',
    });
    await closings.close({ month: '2026-10' });

    await expect(purchasing.payPurchase(purchase.id, { paymentMethod: 'PIX', paidAt: '2026-10-20' })).rejects.toThrow(message);
    expect((await purchasing.getPurchase(purchase.id)).status).toBe('OPEN');
    await expect(purchasing.payPurchase(purchase.id, { paymentMethod: 'PIX', paidAt: '2026-11-13' })).resolves.toMatchObject({ status: 'PAID' });
  });
});

describe('RF-03 e RN-08: reabrir', () => {
  it('CA-05: reabre com motivo, volta a aceitar lançamentos e o novo fechamento soma uma revisão', async () => {
    await octoberWithSeptember();
    await closings.close({ month: '2026-10' });

    const reopened = await closingsController.reopen('2026-10', { reason: '  Nota de gás chegou atrasada  ' });
    expect(reopened).toMatchObject({ status: 'REOPENED', reopenReason: 'Nota de gás chegou atrasada' });
    expect(reopened.reopenedAt).not.toBeNull();

    await service.createExpense({ description: 'Gás', amount: 100, incurredAt: '2026-10-25T10:00:00.000Z' });
    const closedAgain = await closings.close({ month: '2026-10' });

    expect(closedAgain).toMatchObject({ status: 'CLOSED', revision: 2 });
    expect(closedAgain.stored).toMatchObject({ otherExpenses: '130.00', result: '-106.75' });
  });

  it('recusa reabrir mês sem fechamento, mês já reaberto e motivo curto', async () => {
    await closings.close({ month: '2026-10' });

    await expect(closings.reopen('2026-09', { reason: 'Motivo válido' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(closings.reopen('2026-10', { reason: 'erro' })).rejects.toThrow('Informe o motivo da reabertura, de 5 a 300 caracteres.');
    await closings.reopen('2026-10', { reason: 'Motivo válido' });
    await expect(closings.reopen('2026-10', { reason: 'Motivo válido' })).rejects.toThrow('O mês 10/2026 não está fechado.');
  });

  it('mês reaberto aparece como REOPENED na DRE, sem divergências', async () => {
    await closings.close({ month: '2026-10' });
    await closings.reopen('2026-10', { reason: 'Conferência' });
    await service.createExpense({ description: 'Gás', amount: 100, incurredAt: '2026-10-25T10:00:00.000Z' });

    const october = await closings.getMonth('2026-10');

    expect(october.status).toBe('REOPENED');
    expect(october.closing?.divergences).toEqual([]);
  });
});

describe('RN-09: divergências', () => {
  it('CA-06: alteração feita direto no banco depois do fechamento aparece como divergência', async () => {
    await octoberWithSeptember();
    await closings.close({ month: '2026-10' });
    await prisma.expense.create({ data: { description: 'Lançada por fora', amount: '10.00', incurredAt: new Date('2026-10-12T10:00:00.000Z') } });

    const october = await closings.getMonth('2026-10');

    expect(october.status).toBe('CLOSED');
    expect(october.closing?.divergences).toEqual(['otherExpenses', 'result']);
    expect(october.closing?.stored.otherExpenses).toBe('30.00');
    expect(october.dre.otherExpenses).toBe('40.00');
  });
});

describe('validação dos dados de entrada', () => {
  async function invalidFields<T extends object>(dto: new () => T, body: Record<string, unknown>) {
    const errors = await validate(plainToInstance(dto, body), { whitelist: true, forbidNonWhitelisted: true });
    return errors.map((error) => error.property).sort();
  }

  it('fechamento exige mês AAAA-MM e aceita observação', async () => {
    expect(await invalidFields(CloseMonthDto, { month: '2026-10', notes: 'ok' })).toEqual([]);
    expect(await invalidFields(CloseMonthDto, { month: '10/2026' })).toEqual(['month']);
    expect(await invalidFields(CloseMonthDto, {})).toEqual(['month']);
  });

  it('reabertura exige motivo de 5 a 300 caracteres', async () => {
    expect(await invalidFields(ReopenMonthDto, { reason: 'Nota atrasada' })).toEqual([]);
    expect(await invalidFields(ReopenMonthDto, { reason: '  ab  ' })).toEqual(['reason']);
  });
});
