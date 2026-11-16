import { describe, expect, it } from 'vitest';
import { discountCents, orderTotalCents, subtotalCents, toCents } from '../src/common/order-total';
import {
  assertDiscountFits,
  balanceValueCents,
  DEFAULT_RULE,
  mergeRule,
  pointsEarned,
  redemption,
} from '../src/loyalty/loyalty-rules';

// Regras puras da fidelidade e conta única do total (SPEC/2026-11-16-programa-de-fidelidade.md).
describe('RF-06: total da comanda', () => {
  const order = {
    discount: '5.00',
    items: [
      { quantity: 2, unitPrice: '30.00' },
      { quantity: 1, unitPrice: { toString: () => '45.50' } },
    ],
  };

  it('soma os itens e tira o desconto', () => {
    expect(subtotalCents(order)).toBe(10550);
    expect(discountCents(order)).toBe(500);
    expect(orderTotalCents(order)).toBe(10050);
  });

  it('sem desconto, o total é a soma dos itens', () => {
    expect(orderTotalCents({ items: [{ quantity: 3, unitPrice: 0.1 }] })).toBe(30);
    expect(orderTotalCents({ discount: null, items: [] })).toBe(0);
  });

  it('converte para centavos sem erro de arredondamento', () => {
    expect(toCents('19.99')).toBe(1999);
    expect(toCents(0.29)).toBe(29);
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
  });
});

describe('RN-01: regra configurada', () => {
  it('a regra padrão é a de P-1', () => {
    expect(DEFAULT_RULE).toEqual({ pointsPerReal: 1, centsPerPoint: 5, minRedeemPoints: 100 });
  });

  it('muda só os campos enviados', () => {
    expect(mergeRule(DEFAULT_RULE, { pointsPerReal: 3 })).toEqual({ pointsPerReal: 3, centsPerPoint: 5, minRedeemPoints: 100 });
    expect(mergeRule(DEFAULT_RULE, {})).toEqual(DEFAULT_RULE);
    expect(mergeRule(DEFAULT_RULE, { pointsPerReal: 0, centsPerPoint: 1000, minRedeemPoints: 1 })).toEqual({
      pointsPerReal: 0, centsPerPoint: 1000, minRedeemPoints: 1,
    });
    expect(mergeRule(DEFAULT_RULE, { pointsPerReal: 100, centsPerPoint: 1, minRedeemPoints: 100_000 })).toEqual({
      pointsPerReal: 100, centsPerPoint: 1, minRedeemPoints: 100_000,
    });
  });

  it.each([
    ['pointsPerReal', -1],
    ['pointsPerReal', 101],
    ['pointsPerReal', 1.5],
    ['centsPerPoint', 0],
    ['centsPerPoint', 1001],
    ['centsPerPoint', '5'],
    ['minRedeemPoints', 0],
    ['minRedeemPoints', 100_001],
    ['minRedeemPoints', null],
  ])('recusa %s = %s', (field, value) => {
    expect(() => mergeRule(DEFAULT_RULE, { [field]: value })).toThrow(`Regra de fidelidade inválida: ${field}.`);
  });

  it('não altera a regra recebida', () => {
    const current = { ...DEFAULT_RULE };
    mergeRule(current, { pointsPerReal: 7 });
    expect(current).toEqual(DEFAULT_RULE);
  });
});

describe('RN-02: pontos ganhos (CA-01)', () => {
  it.each([
    [4550, 1, 45],
    [4550, 3, 136],
    [4550, 0, 0],
    [99, 1, 0],
    [100, 1, 1],
    [199, 1, 1],
    [10000, 2, 200],
    [0, 5, 0],
    [-500, 5, 0],
  ])('%i centavos com %i ponto(s) por real dá %i', (cents, pointsPerReal, points) => {
    expect(pointsEarned(cents, { pointsPerReal })).toBe(points);
  });
});

describe('RF-03: valor do saldo', () => {
  it('multiplica pelos centavos por ponto e não fica negativo', () => {
    expect(balanceValueCents(240, DEFAULT_RULE)).toBe(1200);
    expect(balanceValueCents(0, DEFAULT_RULE)).toBe(0);
    expect(balanceValueCents(-10, DEFAULT_RULE)).toBe(0);
  });
});

describe('RN-04 a RN-06: resgate', () => {
  const base = { balance: 300, subtotalCents: 2000, hasRedemption: false, rule: DEFAULT_RULE };

  it('troca pontos por desconto', () => {
    expect(redemption({ ...base, points: 100 })).toEqual({ points: 100, discountCents: 500 });
    expect(redemption({ ...base, points: 300 })).toEqual({ points: 300, discountCents: 1500 });
  });

  it('aceita desconto igual ao subtotal (total zero), mas não maior (CA-02)', () => {
    expect(redemption({ ...base, points: 400, balance: 400 })).toEqual({ points: 400, discountCents: 2000 });
    expect(() => redemption({ ...base, points: 401, balance: 500 })).toThrow(
      'O desconto de R$ 20,05 passa do total da comanda (R$ 20,00).',
    );
  });

  it('recusa segundo resgate na mesma comanda', () => {
    expect(() => redemption({ ...base, points: 100, hasRedemption: true })).toThrow(
      'Esta comanda já tem um resgate. Desfaça antes de resgatar de novo.',
    );
  });

  it.each([99, 0, -100, 150.5, '200', undefined])('recusa %s pontos (abaixo do mínimo ou não inteiro)', (points) => {
    expect(() => redemption({ ...base, points })).toThrow('Resgate pelo menos 100 pontos.');
  });

  it('recusa mais do que o saldo', () => {
    expect(() => redemption({ ...base, points: 301 })).toThrow('Saldo insuficiente: o cliente tem 300 pontos.');
    expect(() => redemption({ ...base, points: 100, balance: -5 })).toThrow('Saldo insuficiente: o cliente tem 0 pontos.');
  });

  it('respeita a regra configurada', () => {
    const rule = { pointsPerReal: 1, centsPerPoint: 10, minRedeemPoints: 50 };
    expect(redemption({ ...base, rule, points: 50 })).toEqual({ points: 50, discountCents: 500 });
  });
});

describe('RN-07 e RN-10: desconto cabe no total', () => {
  it('aceita igual e recusa maior', () => {
    expect(() => assertDiscountFits(500, 500)).not.toThrow();
    expect(() => assertDiscountFits(500, 0)).not.toThrow();
    expect(() => assertDiscountFits(499, 500)).toThrow('Desfaça o resgate de pontos antes: o desconto passaria do total da comanda.');
  });
});
