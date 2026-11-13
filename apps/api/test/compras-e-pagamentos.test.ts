import { NotFoundException } from '@nestjs/common';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { controller, prisma, resetDatabase, service } from './support/database';
import { buy, purchasing, purchasingController, supplierNamed } from './support/purchasing';
import { ingredientWith, quantityOf, stock } from './support/stock';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

// Fornecedor ativo, filhote (kg) e açaí (un) já cadastrados.
async function scenario() {
  const supplier = await supplierNamed('Distribuidora Ver-o-Peso');
  const fish = await ingredientWith('Filhote', 1, 'KG');
  const acai = await ingredientWith('Açaí', 0, 'UN');
  return { supplier, fish, acai };
}

async function standardPurchase() {
  const data = await scenario();
  const purchase = await buy(data.supplier.id, [
    { ingredientId: data.fish.id, quantity: 2.5, unitCost: 18.9 },
    { ingredientId: data.acai.id, quantity: 10, unitCost: 3.5 },
  ]);
  return { ...data, purchase };
}

describe('RF-02 e RF-03: registrar compra', () => {
  it('CA-01: calcula totais, fica em aberto e dá entrada no estoque ligada à compra', async () => {
    const { supplier, fish, acai, purchase } = await standardPurchase();

    expect(purchase).toMatchObject({ supplierId: supplier.id, status: 'OPEN', expenseId: null });
    expect(purchase.total.toFixed(2)).toBe('82.25');
    expect(purchase.purchasedAt.toISOString().slice(0, 10)).toBe('2026-11-13');
    expect(purchase.dueDate.toISOString().slice(0, 10)).toBe('2026-11-20');
    expect(purchase.items.map((item) => [item.ingredientName, item.unit, item.quantity.toFixed(3), item.total.toFixed(2)])).toEqual([
      ['Filhote', 'KG', '2.500', '47.25'],
      ['Açaí', 'UN', '10.000', '35.00'],
    ]);
    expect(await quantityOf(fish.id)).toBe('3.500');
    expect(await quantityOf(acai.id)).toBe('10.000');
    const entries = await prisma.stockMovement.findMany({ where: { purchaseId: purchase.id }, orderBy: { ingredientId: 'asc' } });
    expect(entries.map((movement) => [movement.type, movement.quantity.toFixed(3), movement.note])).toEqual([
      ['PURCHASE', '2.500', `Compra #${purchase.id} - Distribuidora Ver-o-Peso`],
      ['PURCHASE', '10.000', `Compra #${purchase.id} - Distribuidora Ver-o-Peso`],
    ]);
  });

  it('guarda nota, observações e data informada', async () => {
    const { supplier, fish } = await scenario();

    const purchase = await purchasingController.createPurchase({
      supplierId: supplier.id,
      invoiceNumber: ' NF 1234 ',
      purchasedAt: '2026-11-10',
      dueDate: '2026-11-10',
      notes: 'À vista',
      items: [{ ingredientId: fish.id, quantity: 1, unitCost: 20 }],
    });

    expect(purchase).toMatchObject({ invoiceNumber: 'NF 1234', notes: 'À vista' });
    expect(purchase.purchasedAt.toISOString().slice(0, 10)).toBe('2026-11-10');
  });

  it('RN-02: fornecedor inativo não recebe compra e nada é gravado', async () => {
    const { supplier, fish } = await scenario();
    await purchasing.updateSupplier(supplier.id, { active: false });

    await expect(buy(supplier.id, [{ ingredientId: fish.id, quantity: 1, unitCost: 10 }])).rejects.toThrow(
      'O fornecedor Distribuidora Ver-o-Peso está inativo.',
    );
    expect(await prisma.purchase.count()).toBe(0);
    expect(await quantityOf(fish.id)).toBe('1.000');
  });

  it('CA-06: recusa ingrediente repetido, inexistente e fornecedor inexistente', async () => {
    const { supplier, fish } = await scenario();
    const line = { ingredientId: fish.id, quantity: 1, unitCost: 10 };

    await expect(buy(supplier.id, [line, line])).rejects.toThrow('O ingrediente Filhote aparece mais de uma vez na compra.');
    await expect(buy(supplier.id, [{ ...line, ingredientId: 999 }])).rejects.toThrow('Ingrediente 999 não encontrado.');
    await expect(buy(999, [line])).rejects.toThrow('Fornecedor não encontrado.');
    expect(await prisma.purchase.count()).toBe(0);
  });

  it('CA-06: recusa datas, quantidades, custos e lista de itens inválidos', async () => {
    const { supplier, fish } = await scenario();
    const line = { ingredientId: fish.id, quantity: 1, unitCost: 10 };

    await expect(buy(supplier.id, [line], { purchasedAt: '2026-11-14' })).rejects.toThrow(
      'A data da compra não pode ser futura.',
    );
    await expect(buy(supplier.id, [line], { purchasedAt: '2026-11-10', dueDate: '2026-11-09' })).rejects.toThrow(
      'O vencimento não pode ser antes da data da compra.',
    );
    await expect(buy(supplier.id, [line], { dueDate: '20/11/2026' })).rejects.toThrow('AAAA-MM-DD');
    await expect(buy(supplier.id, [{ ...line, quantity: 0 }])).rejects.toThrow('maior que zero');
    await expect(buy(supplier.id, [{ ...line, unitCost: 0 }])).rejects.toThrow('custo unitário maior que zero');
    await expect(buy(supplier.id, [])).rejects.toThrow('A compra precisa ter de 1 a 50 itens.');
  });

  it('lista compras por fornecedor e situação, da mais recente para a mais antiga', async () => {
    const { supplier, fish } = await scenario();
    const other = await supplierNamed('Hortifruti Guamá');
    const line = { ingredientId: fish.id, quantity: 1, unitCost: 10 };
    const older = await buy(supplier.id, [line], { purchasedAt: '2026-11-01', dueDate: '2026-11-30' });
    const newer = await buy(supplier.id, [line], { purchasedAt: '2026-11-12', dueDate: '2026-11-30' });
    await buy(other.id, [line]);
    await purchasing.cancelPurchase(newer.id);

    const fromSupplier = await purchasingController.purchases(String(supplier.id));
    const open = await purchasingController.purchases(String(supplier.id), 'OPEN');

    expect(fromSupplier.map((purchase) => purchase.id)).toEqual([newer.id, older.id]);
    expect(open.map((purchase) => purchase.id)).toEqual([older.id]);
    expect(fromSupplier[0].supplier.name).toBe('Distribuidora Ver-o-Peso');
  });

  it('consulta uma compra com itens e avisa quando não existe', async () => {
    const { purchase } = await standardPurchase();

    await expect(purchasingController.purchase(purchase.id)).resolves.toMatchObject({ id: purchase.id });
    await expect(purchasing.getPurchase(999)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RF-05: pagamento vira despesa', () => {
  it('CA-02: fica paga e a despesa entra no relatório financeiro do dia', async () => {
    const { purchase } = await standardPurchase();

    const paid = await purchasingController.pay(purchase.id, { paymentMethod: 'PIX' });

    expect(paid).toMatchObject({ status: 'PAID', paymentMethod: 'PIX' });
    expect(paid.paidAt?.toISOString().slice(0, 10)).toBe('2026-11-13');
    const expense = await prisma.expense.findUniqueOrThrow({ where: { id: paid.expenseId! } });
    expect(expense.description).toBe(`Compra #${purchase.id} - Distribuidora Ver-o-Peso`);
    expect(expense.amount.toFixed(2)).toBe('82.25');
    const report = await controller.report('2026-11-13', '2026-11-13');
    expect(report).toMatchObject({ expenses: '82.25', expenseCount: 1 });
  });

  it('RN-11: aceita data de pagamento entre a compra e hoje; recusa fora disso', async () => {
    const { supplier, fish } = await scenario();
    const line = { ingredientId: fish.id, quantity: 1, unitCost: 10 };
    const purchase = await buy(supplier.id, [line], { purchasedAt: '2026-11-05', dueDate: '2026-11-30' });

    await expect(purchasing.payPurchase(purchase.id, { paymentMethod: 'CASH', paidAt: '2026-11-04' })).rejects.toThrow(
      'O pagamento não pode ser antes da data da compra.',
    );
    await expect(purchasing.payPurchase(purchase.id, { paymentMethod: 'CASH', paidAt: '2026-11-14' })).rejects.toThrow(
      'A data do pagamento não pode ser futura.',
    );
    const paid = await purchasing.payPurchase(purchase.id, { paymentMethod: 'CASH', paidAt: '2026-11-08' });
    expect((await prisma.expense.findUniqueOrThrow({ where: { id: paid.expenseId! } })).incurredAt.toISOString()).toBe(
      '2026-11-08T00:00:00.000Z',
    );
  });

  it('RN-08: não paga duas vezes nem paga compra cancelada', async () => {
    const { purchase } = await standardPurchase();
    await purchasing.payPurchase(purchase.id, { paymentMethod: 'PIX' });

    await expect(purchasing.payPurchase(purchase.id, { paymentMethod: 'PIX' })).rejects.toThrow(
      'Só compras em aberto podem ser pagas ou canceladas.',
    );
    expect(await prisma.expense.count()).toBe(1);
    await expect(purchasing.payPurchase(999, { paymentMethod: 'PIX' })).rejects.toThrow('Compra não encontrada.');
  });

  it('CA-03 e RN-10: a despesa da compra não é editada nem removida pela rota de despesas', async () => {
    const { purchase } = await standardPurchase();
    const paid = await purchasing.payPurchase(purchase.id, { paymentMethod: 'DEBIT' });
    const manual = await service.createExpense({ description: 'Gás', amount: 120 });
    const message = `Esta despesa veio do pagamento da compra #${purchase.id} e não pode ser alterada aqui.`;

    await expect(controller.updateExpense(paid.expenseId!, { amount: 1 })).rejects.toThrow(message);
    await expect(controller.deleteExpense(paid.expenseId!)).rejects.toThrow(message);
    await expect(controller.deleteExpense(manual.id)).resolves.toEqual({ success: true });
  });
});

describe('RF-06: cancelar compra', () => {
  it('CA-04: com estoque intacto, cancela e estorna as entradas', async () => {
    const { fish, acai, purchase } = await standardPurchase();

    const cancelled = await purchasingController.cancel(purchase.id);

    expect(cancelled.status).toBe('CANCELLED');
    expect(await quantityOf(fish.id)).toBe('1.000');
    expect(await quantityOf(acai.id)).toBe('0.000');
    const reversals = await prisma.stockMovement.findMany({ where: { purchaseId: purchase.id, type: 'ADJUSTMENT' } });
    expect(reversals).toHaveLength(2);
    expect(reversals[0].note).toBe(`Cancelamento da compra #${purchase.id}`);
  });

  it('CA-04 e RN-09: se o estoque já foi usado, não cancela e nada muda', async () => {
    const { acai, purchase } = await standardPurchase();
    await stock.registerLoss(acai.id, { quantity: 1, note: 'Caiu no chão' });

    await expect(purchasing.cancelPurchase(purchase.id)).rejects.toThrow(
      'Não é possível cancelar: o estoque de Açaí já foi usado.',
    );
    expect((await purchasing.getPurchase(purchase.id)).status).toBe('OPEN');
    expect(await quantityOf(acai.id)).toBe('9.000');
  });

  it('item cujo ingrediente foi excluído não impede o cancelamento', async () => {
    const { supplier, fish } = await scenario();
    const extra = await ingredientWith('Cheiro-verde', 0, 'UN');
    const purchase = await buy(supplier.id, [
      { ingredientId: fish.id, quantity: 1, unitCost: 10 },
      { ingredientId: extra.id, quantity: 2, unitCost: 1.5 },
    ]);
    await stock.deleteIngredient(extra.id);

    await expect(purchasing.cancelPurchase(purchase.id)).resolves.toMatchObject({ status: 'CANCELLED' });
    expect(await quantityOf(fish.id)).toBe('1.000');
  });

  it('RN-08: não cancela compra paga', async () => {
    const { purchase } = await standardPurchase();
    await purchasing.payPurchase(purchase.id, { paymentMethod: 'PIX' });

    await expect(purchasing.cancelPurchase(purchase.id)).rejects.toThrow(
      'Só compras em aberto podem ser pagas ou canceladas.',
    );
    await expect(purchasing.cancelPurchase(999)).rejects.toThrow('Compra não encontrada.');
  });
});

describe('RF-07: contas a pagar', () => {
  it('CA-05: só compras em aberto, por vencimento, com situação e resumo', async () => {
    const { supplier, fish } = await scenario();
    const line = (unitCost: number) => [{ ingredientId: fish.id, quantity: 1, unitCost }];
    const later = await buy(supplier.id, line(5), { purchasedAt: '2026-11-01', dueDate: '2026-11-25' });
    const overdue = await buy(supplier.id, line(10), { purchasedAt: '2026-11-01', dueDate: '2026-11-05' });
    const today = await buy(supplier.id, line(20), { purchasedAt: '2026-11-01', dueDate: '2026-11-13' });
    const soon = await buy(supplier.id, line(40), { purchasedAt: '2026-11-01', dueDate: '2026-11-19' });
    const paid = await buy(supplier.id, line(80), { purchasedAt: '2026-11-01', dueDate: '2026-11-02' });
    await purchasing.payPurchase(paid.id, { paymentMethod: 'PIX' });

    const result = await purchasingController.payables();

    expect(result.today).toBe('2026-11-13');
    expect(result.payables.map((purchase) => [purchase.id, purchase.situation])).toEqual([
      [overdue.id, 'OVERDUE'],
      [today.id, 'DUE_TODAY'],
      [soon.id, 'UPCOMING'],
      [later.id, 'UPCOMING'],
    ]);
    expect(result.summary).toEqual({ count: 4, open: '75.00', overdue: '10.00', dueNext7Days: '60.00' });
  });

  it('sem contas em aberto, resumo zerado', async () => {
    const result = await purchasing.payables();

    expect(result.payables).toEqual([]);
    expect(result.summary).toEqual({ count: 0, open: '0.00', overdue: '0.00', dueNext7Days: '0.00' });
  });
});
