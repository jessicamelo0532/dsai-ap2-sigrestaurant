import { describe, expect, it } from 'vitest';
import {
  ADDRESS_ERROR, canCancel, canDeliver, canDispatch, canEdit, canPay, createBody, feeCents, feeFromCents, FEE_ERROR,
  FILTERS, formFrom, formatDateTime, itemCount, itemPath, listPath, RECIPIENT_ERROR, summarize, situationLabel,
  situationOf, STATUS_LABELS, updateBody, validateDeliveryForm, type DeliveryOrder,
} from './delivery';

// SPEC/2026-11-25-tela-de-delivery.md (CA-01 a CA-04, CA-06).

const order: DeliveryOrder = {
  id: 12,
  status: 'OPEN',
  openedAt: '2026-11-25T18:00:00.000Z',
  recipient: 'Ana Souza',
  deliveryAddress: 'Rua das Flores, 123',
  deliveryPhone: '91999998888',
  deliveryStatus: 'RECEIVED',
  subtotal: '30.00',
  discount: '0.00',
  deliveryFee: '5.00',
  total: '35.00',
  items: [
    { id: 1, menuItemId: 7, nameSnapshot: 'Pizza', unitPrice: '15.00', quantity: 2 },
  ],
};

const validForm = { recipient: 'Ana Souza', address: 'Rua das Flores, 123', phone: '(91) 99999-8888', fee: '5,00', customerId: null };

describe('regras do delivery (CA-01, CA-04)', () => {
  it('valida destinatário, endereço, telefone e taxa como a API', () => {
    expect(validateDeliveryForm(validForm)).toBeNull();
    expect(validateDeliveryForm({ ...validForm, recipient: 'A' })).toBe(RECIPIENT_ERROR);
    expect(validateDeliveryForm({ ...validForm, recipient: 'a'.repeat(81) })).toBe(RECIPIENT_ERROR);
    expect(validateDeliveryForm({ ...validForm, address: 'Rua' })).toBe(ADDRESS_ERROR);
    expect(validateDeliveryForm({ ...validForm, phone: '1234' })).toBe('Informe o telefone com DDD, com 10 ou 11 dígitos.');
    expect(validateDeliveryForm({ ...validForm, fee: '100,01' })).toBe(FEE_ERROR);
    expect(validateDeliveryForm({ ...validForm, fee: '-1' })).toBe(FEE_ERROR);
    expect(validateDeliveryForm({ ...validForm, fee: 'abc' })).toBe(FEE_ERROR);
  });

  it('aceita telefone vazio e taxa zero', () => {
    expect(validateDeliveryForm({ ...validForm, phone: '', fee: '0' })).toBeNull();
    expect(validateDeliveryForm({ ...validForm, fee: '100,00' })).toBeNull();
  });

  it('converte a taxa digitada em centavos', () => {
    expect(feeCents('5')).toBe(500);
    expect(feeCents('5,50')).toBe(550);
    expect(feeCents('R$ 12.5')).toBe(1250);
    expect(feeCents('1.234,56')).toBe(123456);
    expect(feeCents('')).toBeNull();
    expect(feeCents('5,555')).toBeNull();
    expect(feeFromCents(1250)).toBe('12,50');
  });

  it('monta o corpo da criação sem campos vazios', () => {
    expect(createBody(validForm)).toEqual({
      recipient: 'Ana Souza',
      address: 'Rua das Flores, 123',
      phone: '(91) 99999-8888',
      fee: 5,
    });
    expect(createBody({ ...validForm, phone: '', customerId: 3 })).toEqual({
      recipient: 'Ana Souza',
      address: 'Rua das Flores, 123',
      fee: 5,
      customerId: 3,
    });
  });

  it('manda na edição só o que mudou, apagando telefone com null', () => {
    expect(updateBody(order, formFrom(order))).toEqual({});
    expect(updateBody(order, { ...formFrom(order), phone: '' })).toEqual({ phone: null });
    expect(updateBody(order, { ...formFrom(order), recipient: 'Bia', fee: '7,50' })).toEqual({ recipient: 'Bia', fee: 7.5 });
  });

  it('preenche o formulário a partir do pedido', () => {
    expect(formFrom(order)).toEqual({ recipient: 'Ana Souza', address: 'Rua das Flores, 123', phone: '(91) 99999-8888', fee: '5,00', customerId: null });
    expect(formFrom(null)).toEqual({ recipient: '', address: '', phone: '', fee: '0,00', customerId: null });
  });
});

describe('situação e ações do pedido (CA-02, CA-03)', () => {
  it('oferece cada ação só na situação válida', () => {
    expect(canEdit(order)).toBe(true);
    expect(canDispatch(order)).toBe(true);
    expect(canDeliver(order)).toBe(false);
    expect(canPay(order)).toBe(true);
    expect(canCancel(order)).toBe(true);

    const out = { ...order, deliveryStatus: 'OUT_FOR_DELIVERY' as const };
    expect(canEdit(out)).toBe(false);
    expect(canDispatch(out)).toBe(false);
    expect(canDeliver(out)).toBe(true);

    const paid = { ...order, status: 'PAID' as const };
    expect(canPay(paid)).toBe(false);
    expect(canCancel(paid)).toBe(false);
    expect(canDispatch(paid)).toBe(false);
  });

  it('mostra cancelado quando a comanda foi cancelada', () => {
    const cancelled = { ...order, status: 'CANCELLED' as const };
    expect(situationOf(cancelled)).toBe('CANCELLED');
    expect(situationLabel(cancelled)).toBe('Cancelado');
    expect(STATUS_LABELS.OUT_FOR_DELIVERY).toBe('Saiu para entrega');
  });

  it('resume os pedidos carregados', () => {
    const out = { ...order, id: 13, deliveryStatus: 'OUT_FOR_DELIVERY' as const, total: '20.00' };
    expect(summarize([order, out])).toEqual({ count: 2, received: 1, outForDelivery: 1, totalCents: 5500 });
    expect(summarize([])).toEqual({ count: 0, received: 0, outForDelivery: 0, totalCents: 0 });
  });

  it('soma as quantidades dos itens', () => {
    expect(itemCount(order)).toBe(2);
  });
});

describe('rotas e formatação', () => {
  it('monta a rota da lista por filtro', () => {
    expect(listPath('ativos')).toBe('/delivery-orders');
    expect(listPath('OUT_FOR_DELIVERY')).toBe('/delivery-orders?status=OUT_FOR_DELIVERY');
    expect(FILTERS.map((entry) => entry.id)).toEqual(['ativos', 'RECEIVED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']);
  });

  it('formata data e hora e trata valor inválido', () => {
    expect(formatDateTime('2026-11-25T18:05:00.000Z')).toMatch(/^25\/11\/2026 \d{2}:05$/);
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('sem data')).toBe('—');
  });

  it('monta a rota de item do pedido', () => {
    expect(itemPath(12)).toBe('/delivery-orders/12/items');
  });
});
