import { describe, expect, it } from 'vitest';
import {
  SPLIT_DUPLICATE_ITEM, SPLIT_EMPTY_PERSON, SPLIT_ITEM_ERROR, SPLIT_NAME_ERROR, SPLIT_SUM_ERROR,
  SPLIT_VALUE_ERROR, moneyDecimal, parseCents, splitByItem, splitByValue, splitEqual, splitSummary,
  validateDrafts, validatePeople,
} from './divisao';
import type { Order } from './types';

const order = (extra: Partial<Order> = {}): Order => ({
  id: 10, tableNumber: 1, status: 'OPEN', openedAt: '2026-11-19T12:00:00.000Z',
  items: [
    { id: 1, menuItemId: 1, nameSnapshot: 'Moqueca', unitPrice: '45.00', quantity: 1 },
    { id: 2, menuItemId: 2, nameSnapshot: 'Suco', unitPrice: '7.50', quantity: 2 },
  ],
  ...extra,
});

describe('valores e pessoas (RF-01, RN-04)', () => {
  it('lê centavos sem perder arredondamento', () => {
    expect(parseCents('30')).toBe(3000);
    expect(parseCents('30,5')).toBe(3050);
    expect(parseCents('30.50')).toBe(3050);
    expect(parseCents('30.555')).toBeNaN();
    expect(parseCents('-1')).toBeNaN();
    expect(moneyDecimal(3334)).toBe('33.34');
  });

  it('exige de 2 a 50 pessoas', () => {
    expect(validatePeople(2)).toBeNull();
    expect(validatePeople(50)).toBeNull();
    expect(validatePeople(1)).toBe('Informe de 2 a 50 pessoas.');
    expect(validatePeople(2.5)).toBe('Informe de 2 a 50 pessoas.');
  });
});

describe('por igual (RN-01)', () => {
  it('divide e joga o resto na última parcela', () => {
    expect(splitEqual(6000, 3).map((draft) => draft.amount)).toEqual(['20.00', '20.00', '20.00']);
    expect(splitEqual(10000, 3).map((draft) => draft.amount)).toEqual(['33.33', '33.33', '33.34']);
  });

  it('usa nomes padrão e nomes informados', () => {
    expect(splitEqual(4000, 2).map((draft) => draft.name)).toEqual(['Pessoa 1', 'Pessoa 2']);
    expect(splitEqual(4000, 2, ['Ana', 'Bia']).map((draft) => draft.name)).toEqual(['Ana', 'Bia']);
  });
});

describe('por item (RN-02)', () => {
  it('soma cada linha e rateia o desconto', () => {
    const drafts = splitByItem(order({ discount: '10.00' }), [
      { name: 'Ana', itemIds: [1] },
      { name: 'Bia', itemIds: [2] },
    ]);
    expect(drafts.map((draft) => draft.amount)).toEqual(['37.50', '12.50']);
    expect(drafts[0].items).toEqual([{ itemId: 1, quantity: 1 }]);
    expect(drafts[1].items).toEqual([{ itemId: 2, quantity: 2 }]);
  });

  it('recusa item repetido, item sem dono e pessoa sem item', () => {
    expect(() => splitByItem(order(), [{ name: 'Ana', itemIds: [1] }, { name: 'Bia', itemIds: [1, 2] }])).toThrow(SPLIT_DUPLICATE_ITEM);
    expect(() => splitByItem(order(), [{ name: 'Ana', itemIds: [1] }, { name: 'Bia', itemIds: [] }])).toThrow(SPLIT_ITEM_ERROR);
    expect(() => splitByItem(order(), [{ name: 'Ana', itemIds: [1, 2] }, { name: 'Bia', itemIds: [] }])).toThrow(SPLIT_EMPTY_PERSON);
  });
});

describe('por valor (RN-03)', () => {
  it('aceita quando a soma fecha no total', () => {
    expect(splitByValue([{ name: 'Ana', amount: '30,00' }, { name: 'Bia', amount: '30' }], 6000)).toEqual([
      { name: 'Ana', amount: '30.00' }, { name: 'Bia', amount: '30.00' },
    ]);
  });

  it('recusa soma diferente, valor zero e nome vazio', () => {
    expect(() => splitByValue([{ name: 'Ana', amount: '20' }, { name: 'Bia', amount: '20' }], 6000)).toThrow(SPLIT_SUM_ERROR);
    expect(() => splitByValue([{ name: 'Ana', amount: '0' }, { name: 'Bia', amount: '60' }], 6000)).toThrow(SPLIT_VALUE_ERROR);
    expect(() => splitByValue([{ name: '  ', amount: '30' }, { name: 'Bia', amount: '30' }], 6000)).toThrow(SPLIT_NAME_ERROR);
  });
});

describe('validação e resumo (CA-03)', () => {
  it('valida rascunhos antes de persistir', () => {
    expect(validateDrafts([{ name: 'Ana', amount: '30.00' }, { name: 'Bia', amount: '30.00' }], 6000)).toBeNull();
    expect(validateDrafts([{ name: 'Ana', amount: '30.00' }], 6000)).toBe('Informe de 2 a 50 pessoas.');
  });

  it('resume pagas e em aberto', () => {
    const summary = splitSummary([
      { id: 1, name: 'Ana', amount: '30.00', paid: true, paymentMethod: 'PIX' },
      { id: 2, name: 'Bia', amount: '30.00', paid: false },
    ]);
    expect(summary).toEqual({ count: 2, paidCount: 1, total: '60.00', paid: '30.00', remaining: '30.00', allPaid: false });
  });
});
