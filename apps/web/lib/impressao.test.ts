import { describe, expect, it } from 'vitest';
import {
  buildBobina, buildCupom, formatDateTime, itemCountLabel, paymentLabel, printLines, tableName,
} from './impressao';
import { money } from './format';
import type { Order } from './types';

const openedAt = new Date(2026, 10, 17, 19, 30).toISOString();
const paidAt = new Date(2026, 10, 17, 20, 15).toISOString();

const order = (overrides: Partial<Order> = {}): Order => ({
  id: 10,
  tableNumber: 3,
  status: 'OPEN',
  openedAt,
  items: [
    { id: 1, menuItemId: 1, nameSnapshot: 'Açaí', unitPrice: '18.00', quantity: 2 },
    { id: 2, menuItemId: 2, nameSnapshot: 'Suco', unitPrice: '7.50', quantity: 1 },
  ],
  ...overrides,
});

describe('forma de pagamento (RN-02)', () => {
  it('traduz as formas conhecidas', () => {
    expect(paymentLabel('CASH')).toBe('Dinheiro');
    expect(paymentLabel('CREDIT')).toBe('Crédito');
    expect(paymentLabel('DEBIT')).toBe('Débito');
    expect(paymentLabel('PIX')).toBe('Pix');
  });

  it('mantém a forma desconhecida e avisa quando não veio', () => {
    expect(paymentLabel('VOUCHER')).toBe('VOUCHER');
    expect(paymentLabel(null)).toBe('Não informada');
    expect(paymentLabel(undefined)).toBe('Não informada');
  });
});

describe('identificação e datas', () => {
  it('escreve o nome da mesa com dois dígitos', () => {
    expect(tableName(1)).toBe('Mesa 01');
    expect(tableName(12)).toBe('Mesa 12');
  });

  it('formata data e hora no padrão brasileiro', () => {
    expect(formatDateTime(openedAt)).toBe('17/11/2026 19:30');
    expect(formatDateTime(paidAt)).toBe('17/11/2026 20:15');
  });

  it('usa travessão quando a data não existe ou é inválida', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('não é data')).toBe('—');
  });
});

describe('linhas impressas (RN-03)', () => {
  it('leva quantidade, nome, preço unitário e subtotal', () => {
    expect(printLines(order())).toEqual([
      { quantity: 2, name: 'Açaí', unitPrice: money('18.00'), total: money(36) },
      { quantity: 1, name: 'Suco', unitPrice: money('7.50'), total: money(7.5) },
    ]);
  });
});

describe('bobina da comanda (RF-01)', () => {
  it('monta o papel com itens, contagem e total', () => {
    const bobina = buildBobina(order());
    expect(bobina.kind).toBe('bobina');
    expect(bobina.title).toBe('COMANDA');
    expect(bobina.restaurant).toBe('Mesa Clara');
    expect(bobina.table).toBe('Mesa 03');
    expect(bobina.openedAt).toBe('17/11/2026 19:30');
    expect(bobina.lines).toHaveLength(2);
    expect(bobina.itemCount).toBe(3);
    expect(bobina.total).toBe(money(43.5));
  });

  it('apara a observação e ignora observação em branco', () => {
    expect(buildBobina(order(), '  sem cebola ').note).toBe('sem cebola');
    expect(buildBobina(order(), '   ').note).toBeNull();
    expect(buildBobina(order()).note).toBeNull();
  });

  it('aceita comanda sem itens com total zero', () => {
    const bobina = buildBobina(order({ items: [] }));
    expect(bobina.lines).toEqual([]);
    expect(bobina.itemCount).toBe(0);
    expect(bobina.total).toBe(money(0));
  });
});

describe('cupom da conta (RF-02)', () => {
  it('monta o cupom com forma de pagamento, total e data', () => {
    const cupom = buildCupom(order({ status: 'PAID', paymentMethod: 'PIX', paidAt }));
    expect(cupom.kind).toBe('cupom');
    expect(cupom.title).toBe('CONTA FECHADA');
    expect(cupom.table).toBe('Mesa 03');
    expect(cupom.payment).toBe('Pix');
    expect(cupom.paidAt).toBe('17/11/2026 20:15');
    expect(cupom.total).toBe(money(43.5));
    expect(cupom.orderId).toBe(10);
  });

  it('não inventa pagamento quando a comanda não tem', () => {
    const cupom = buildCupom(order());
    expect(cupom.payment).toBe('Não informada');
    expect(cupom.paidAt).toBe('—');
  });
});

describe('contagem de itens', () => {
  it('usa singular e plural', () => {
    expect(itemCountLabel(1)).toBe('1 item');
    expect(itemCountLabel(3)).toBe('3 itens');
  });
});
