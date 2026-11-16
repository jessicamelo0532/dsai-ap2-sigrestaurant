// Regras puras do delivery (SPEC/2026-11-16-delivery.md).
import { BadRequestException } from '@nestjs/common';

export type DeliveryStatus = 'RECEIVED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
export type DeliveryAction = 'dispatch' | 'deliver';
export type Channel = 'DINE_IN' | 'DELIVERY';

export const MAX_FEE_CENTS = 10_000;

const STATUS_LABEL: Record<DeliveryStatus | 'CANCELLED', string> = {
  RECEIVED: 'recebido',
  OUT_FOR_DELIVERY: 'saiu para entrega',
  DELIVERED: 'entregue',
  CANCELLED: 'cancelado',
};
const ACTION_LABEL: Record<DeliveryAction, string> = { dispatch: 'sair para entrega', deliver: 'ser entregue' };
const TRANSITIONS: Record<DeliveryAction, { from: DeliveryStatus; to: DeliveryStatus }> = {
  dispatch: { from: 'RECEIVED', to: 'OUT_FOR_DELIVERY' },
  deliver: { from: 'OUT_FOR_DELIVERY', to: 'DELIVERED' },
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

// RN-01
export function recipientName(value: unknown) {
  const name = cleanText(value);
  if (name.length < 2 || name.length > 80) throw new BadRequestException('Informe o nome de quem recebe, de 2 a 80 caracteres.');
  return name;
}

export function deliveryAddress(value: unknown) {
  const address = cleanText(value);
  if (address.length < 5 || address.length > 200) throw new BadRequestException('Informe o endereço de entrega, de 5 a 200 caracteres.');
  return address;
}

// RN-03 e P-1
export function parseDeliveryFee(value: unknown) {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  const cents = Math.round(number * 100);
  if (!Number.isFinite(number) || Math.abs(number * 100 - cents) > 1e-6 || cents < 0 || cents > MAX_FEE_CENTS) {
    throw new BadRequestException('Informe a taxa de entrega de R$ 0,00 a R$ 100,00.');
  }
  return cents;
}

// RN-04: cancelado vem da situação da comanda e não anda mais.
export function nextDeliveryStatus(current: DeliveryStatus, cancelled: boolean, action: DeliveryAction): DeliveryStatus {
  const rule = TRANSITIONS[action];
  if (cancelled || current !== rule.from) {
    const label = STATUS_LABEL[cancelled ? 'CANCELLED' : current];
    throw new BadRequestException(`Este pedido está ${label} e não pode ${ACTION_LABEL[action]}.`);
  }
  return rule.to;
}

export function deliveryTimestamp(action: DeliveryAction) {
  return action === 'dispatch' ? 'dispatchedAt' : 'deliveredAt';
}

// RN-05 e P-3: só pedido aberto e ainda não saído (pago também não muda, para o total pago não mudar).
export function assertDeliveryEditable(orderStatus: string, deliveryStatus: DeliveryStatus) {
  if (orderStatus === 'CANCELLED') throw new BadRequestException('Este pedido está cancelado e não pode mudar.');
  if (orderStatus !== 'OPEN') throw new BadRequestException('Este pedido já foi pago e não pode mudar.');
  if (deliveryStatus !== 'RECEIVED') throw new BadRequestException('O pedido já saiu para entrega e não pode mudar.');
}

// RF-06: receita do período separada por canal, com a soma das taxas.
export function revenueByChannel(orders: readonly { channel: Channel; totalCents: number; feeCents: number }[]) {
  const result = { DINE_IN: 0, DELIVERY: 0, deliveryFees: 0 };
  for (const order of orders) {
    result[order.channel] += order.totalCents;
    result.deliveryFees += order.feeCents;
  }
  return result;
}
