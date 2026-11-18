import { describe, expect, it } from 'vitest';
import {
  customerLabel, discountCents, dueCents, hasRedemption, maxRedeemablePoints, parsePoints, redeemDiscountCents,
  redeemPreview, subtotalCents, validateRedeem, waiterChoices, type LoyaltyRule,
} from './comanda';
import type { Order } from './types';

const rule: LoyaltyRule = { pointsPerReal: 1, centsPerPoint: 5, minRedeemPoints: 100 };
const flat = (text: string) => text.replace(/\s/g, ' ');

const order = (extra: Partial<Order> = {}): Order => ({
  id: 9, tableNumber: 4, status: 'OPEN', openedAt: '2026-11-17T12:00:00.000Z',
  items: [
    { id: 1, menuItemId: 1, nameSnapshot: 'Moqueca', unitPrice: '45.00', quantity: 1 },
    { id: 2, menuItemId: 2, nameSnapshot: 'Suco', unitPrice: '7.50', quantity: 2 },
  ],
  ...extra,
});

describe('garçons para escolher (RN-01, RF-02)', () => {
  const waiters = [
    { id: 1, name: 'Rui', active: true },
    { id: 2, name: 'Bia', active: false },
    { id: 3, name: 'Ana', active: true },
  ];

  it('só ativos, em ordem de nome', () => {
    expect(waiterChoices(waiters, null).map((waiter) => waiter.name)).toEqual(['Ana', 'Rui']);
  });

  it('mantém o atual mesmo desativado', () => {
    expect(waiterChoices(waiters, 2).map((waiter) => waiter.name)).toEqual(['Ana', 'Bia', 'Rui']);
  });
});

describe('totais (RN-05, CA-07)', () => {
  it('subtotal, desconto e total a pagar', () => {
    const withDiscount = order({ discount: '10.00', loyaltyPoints: 200 });
    expect(subtotalCents(withDiscount)).toBe(6000);
    expect(discountCents(withDiscount)).toBe(1000);
    expect(dueCents(withDiscount)).toBe(5000);
    expect(hasRedemption(withDiscount)).toBe(true);
  });

  it('sem desconto o total é o subtotal', () => {
    expect(discountCents(order())).toBe(0);
    expect(dueCents(order())).toBe(6000);
    expect(hasRedemption(order())).toBe(false);
  });

  it('nunca fica negativo', () => {
    expect(dueCents(order({ discount: '99.00' }))).toBe(0);
  });
});

describe('resgate (RN-02, RN-03)', () => {
  const context = { balance: 250, subtotalCents: 6000, rule };

  it('lê pontos inteiros', () => {
    expect(parsePoints('200')).toBe(200);
    expect(parsePoints('1.200')).toBe(1200);
    expect(parsePoints('2,5')).toBeNaN();
    expect(parsePoints('')).toBeNaN();
  });

  it('aceita dentro do saldo e do subtotal', () => {
    expect(validateRedeem(200, context)).toBeNull();
    expect(redeemDiscountCents(200, rule)).toBe(1000);
  });

  it('recusa abaixo do mínimo e acima do saldo', () => {
    expect(validateRedeem(50, context)).toBe('Resgate pelo menos 100 pontos.');
    expect(validateRedeem(Number.NaN, context)).toBe('Resgate pelo menos 100 pontos.');
    expect(validateRedeem(300, context)).toBe('Saldo insuficiente: o cliente tem 250 pontos.');
  });

  it('recusa desconto maior que o subtotal', () => {
    expect(flat(validateRedeem(1300, { ...context, balance: 2000 }) ?? '')).toBe('O desconto de R$ 65,00 passa do total da comanda (R$ 60,00).');
  });

  it('maior resgate possível', () => {
    expect(maxRedeemablePoints(250, 6000, rule)).toBe(250);
    expect(maxRedeemablePoints(2000, 6000, rule)).toBe(1200);
    expect(maxRedeemablePoints(80, 6000, rule)).toBe(0);
    expect(maxRedeemablePoints(500, 400, rule)).toBe(0);
  });

  it('prévia do desconto', () => {
    expect(flat(redeemPreview(200, rule))).toBe('200 pontos viram R$ 10,00 de desconto.');
    expect(redeemPreview(0, rule)).toBe('');
    expect(redeemPreview(Number.NaN, rule)).toBe('');
  });
});

describe('rótulos', () => {
  it('cliente com e sem telefone', () => {
    expect(customerLabel({ name: 'Ana', phone: '91988887777' })).toBe('Ana · 91988887777');
    expect(customerLabel({ name: 'Ana', phone: null })).toBe('Ana');
  });
});
