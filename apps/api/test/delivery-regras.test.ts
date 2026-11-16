import { describe, expect, it } from 'vitest';
import { deliveryFeeCents, orderTotalCents } from '../src/common/order-total';
import {
  assertDeliveryEditable,
  deliveryAddress,
  deliveryTimestamp,
  nextDeliveryStatus,
  parseDeliveryFee,
  recipientName,
  revenueByChannel,
} from '../src/delivery/delivery-rules';

// Regras puras do delivery (SPEC/2026-11-16-delivery.md).
describe('RF-03: total com a taxa (CA-01)', () => {
  it('soma a taxa depois do desconto', () => {
    const order = { discount: '5.00', deliveryFee: '7.50', items: [{ quantity: 2, unitPrice: '20.00' }] };
    expect(deliveryFeeCents(order)).toBe(750);
    expect(orderTotalCents(order)).toBe(4250);
    expect(orderTotalCents({ deliveryFee: null, items: [{ quantity: 1, unitPrice: 10 }] })).toBe(1000);
  });
});

describe('RN-01 a RN-03: dados do pedido', () => {
  it('limpa nome e endereço', () => {
    expect(recipientName('  Ana   Souza ')).toBe('Ana Souza');
    expect(deliveryAddress(' Rua das Flores,  10 ')).toBe('Rua das Flores, 10');
    expect(recipientName('Li')).toBe('Li');
    expect(deliveryAddress('Rua A')).toBe('Rua A');
    expect(deliveryAddress('x'.repeat(200))).toHaveLength(200);
  });

  it.each([undefined, 'A', 'x'.repeat(81), 7])('recusa destinatário %s', (value) => {
    expect(() => recipientName(value)).toThrow('Informe o nome de quem recebe, de 2 a 80 caracteres.');
  });

  it.each([undefined, 'Rua', 'x'.repeat(201)])('recusa endereço %s', (value) => {
    expect(() => deliveryAddress(value)).toThrow('Informe o endereço de entrega, de 5 a 200 caracteres.');
  });

  it('aceita taxa de 0 a 100 reais com até 2 casas (P-1)', () => {
    expect(parseDeliveryFee(0)).toBe(0);
    expect(parseDeliveryFee('7.5')).toBe(750);
    expect(parseDeliveryFee(100)).toBe(10_000);
  });

  it.each([-0.01, 100.01, 7.555, '', 'sete', null])('recusa taxa %s', (value) => {
    expect(() => parseDeliveryFee(value)).toThrow('Informe a taxa de entrega de R$ 0,00 a R$ 100,00.');
  });
});

describe('RN-04: situação da entrega', () => {
  it('segue recebido → saiu → entregue', () => {
    expect(nextDeliveryStatus('RECEIVED', false, 'dispatch')).toBe('OUT_FOR_DELIVERY');
    expect(nextDeliveryStatus('OUT_FOR_DELIVERY', false, 'deliver')).toBe('DELIVERED');
    expect(deliveryTimestamp('dispatch')).toBe('dispatchedAt');
    expect(deliveryTimestamp('deliver')).toBe('deliveredAt');
  });

  it.each([
    ['RECEIVED', false, 'deliver', 'Este pedido está recebido e não pode ser entregue.'],
    ['OUT_FOR_DELIVERY', false, 'dispatch', 'Este pedido está saiu para entrega e não pode sair para entrega.'],
    ['DELIVERED', false, 'deliver', 'Este pedido está entregue e não pode ser entregue.'],
    ['RECEIVED', true, 'dispatch', 'Este pedido está cancelado e não pode sair para entrega.'],
  ] as const)('recusa %s (cancelado: %s) → %s', (status, cancelled, action, message) => {
    expect(() => nextDeliveryStatus(status, cancelled, action)).toThrow(message);
  });
});

describe('RN-05: edição', () => {
  it('só muda antes de sair e se não estiver cancelado (P-3)', () => {
    expect(() => assertDeliveryEditable('OPEN', 'RECEIVED')).not.toThrow();
    expect(() => assertDeliveryEditable('PAID', 'RECEIVED')).toThrow('Este pedido já foi pago e não pode mudar.');
    expect(() => assertDeliveryEditable('OPEN', 'OUT_FOR_DELIVERY')).toThrow('O pedido já saiu para entrega e não pode mudar.');
    expect(() => assertDeliveryEditable('OPEN', 'DELIVERED')).toThrow('O pedido já saiu para entrega e não pode mudar.');
    expect(() => assertDeliveryEditable('CANCELLED', 'RECEIVED')).toThrow('Este pedido está cancelado e não pode mudar.');
  });
});

describe('RF-06: receita por canal (CA-02)', () => {
  it('separa salão e delivery e soma as taxas', () => {
    expect(
      revenueByChannel([
        { channel: 'DINE_IN', totalCents: 10000, feeCents: 0 },
        { channel: 'DELIVERY', totalCents: 4750, feeCents: 750 },
        { channel: 'DELIVERY', totalCents: 2000, feeCents: 0 },
      ]),
    ).toEqual({ DINE_IN: 10000, DELIVERY: 6750, deliveryFees: 750 });
    expect(revenueByChannel([])).toEqual({ DINE_IN: 0, DELIVERY: 0, deliveryFees: 0 });
  });
});
