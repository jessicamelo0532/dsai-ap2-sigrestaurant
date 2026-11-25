// Tela de delivery (SPEC/2026-11-25-tela-de-delivery.md).
// Funções puras: espelham os limites da API de delivery e preparam a tela.

import { cleanName, formatPhone, phoneDigits, PHONE_ERROR } from './clientes';

export type DeliveryStatus = 'RECEIVED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
export type DeliveryFilter = 'ativos' | DeliveryStatus;
export type DeliveryOrderStatus = 'OPEN' | 'PAID' | 'CANCELLED' | 'ON_ACCOUNT' | 'MERGED';

export type DeliveryAddon = { id: number; name: string; price: string };

export type DeliveryItem = {
  id: number;
  menuItemId: number | null;
  nameSnapshot: string;
  unitPrice: string;
  quantity: number;
  addons?: DeliveryAddon[];
};

export type DeliveryOrder = {
  id: number;
  status: DeliveryOrderStatus;
  paymentMethod?: string | null;
  openedAt: string;
  paidAt?: string | null;
  recipient: string;
  deliveryAddress: string;
  deliveryPhone?: string | null;
  deliveryStatus: DeliveryStatus;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  customerId?: number | null;
  subtotal: string;
  discount: string;
  deliveryFee: string;
  total: string;
  items: DeliveryItem[];
};

export type DeliveryForm = {
  recipient: string;
  address: string;
  phone: string;
  fee: string;
  customerId: number | null;
};

export const RECIPIENT_ERROR = 'Informe o nome de quem recebe, de 2 a 80 caracteres.';
export const ADDRESS_ERROR = 'Informe o endereço de entrega, de 5 a 200 caracteres.';
export const FEE_ERROR = 'Informe a taxa de entrega de R$ 0,00 a R$ 100,00.';

export const MAX_FEE_CENTS = 10_000;

export const STATUS_LABELS: Record<DeliveryStatus, string> = {
  RECEIVED: 'Recebido',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

export const FILTERS: { id: DeliveryFilter; label: string }[] = [
  { id: 'ativos', label: 'Ativos' },
  { id: 'RECEIVED', label: 'Recebidos' },
  { id: 'OUT_FOR_DELIVERY', label: 'Saiu para entrega' },
  { id: 'DELIVERED', label: 'Entregues' },
  { id: 'CANCELLED', label: 'Cancelados' },
];

export const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Dinheiro' },
  { id: 'CREDIT', label: 'Crédito' },
  { id: 'DEBIT', label: 'Débito' },
  { id: 'PIX', label: 'Pix' },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['id'];

const cleanAddress = (value: string) => value.trim().replace(/\s+/g, ' ');

// RN-03 da SPEC da API: de R$ 0,00 a R$ 100,00, com até 2 casas.
export function feeCents(raw: string): number | null {
  const compact = raw.replace(/R\$/i, '').replace(/\s+/g, '');
  if (!compact) return null;
  const normalized = compact.includes(',') ? compact.replace(/\./g, '').replace(',', '.') : compact;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [reais, centavos = ''] = normalized.split('.');
  return Number(reais) * 100 + Number(centavos.padEnd(2, '0'));
}

export function feeFromCents(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

// RN-01 a RN-03.
export function validateDeliveryForm(form: DeliveryForm): string | null {
  const recipient = cleanName(form.recipient).length;
  if (recipient < 2 || recipient > 80) return RECIPIENT_ERROR;
  const address = cleanAddress(form.address).length;
  if (address < 5 || address > 200) return ADDRESS_ERROR;
  if (form.phone.trim()) {
    const digits = phoneDigits(form.phone).length;
    if (digits !== 10 && digits !== 11) return PHONE_ERROR;
  }
  const cents = feeCents(form.fee);
  if (cents === null || cents < 0 || cents > MAX_FEE_CENTS) return FEE_ERROR;
  return null;
}

// RF-02: corpo da criação, sem campos opcionais vazios.
export function createBody(form: DeliveryForm) {
  const phone = form.phone.trim();
  return {
    recipient: cleanName(form.recipient),
    address: cleanAddress(form.address),
    ...(phone ? { phone } : {}),
    fee: (feeCents(form.fee) ?? 0) / 100,
    ...(form.customerId ? { customerId: form.customerId } : {}),
  };
}

// RF-06: só o que mudou; telefone apagado vai como null.
export function updateBody(order: DeliveryOrder, form: DeliveryForm) {
  const body: { recipient?: string; address?: string; phone?: string | null; fee?: number } = {};
  const recipient = cleanName(form.recipient);
  if (recipient !== order.recipient) body.recipient = recipient;
  const address = cleanAddress(form.address);
  if (address !== order.deliveryAddress) body.address = address;
  const phone = form.phone.trim();
  if (phone ? phoneDigits(phone) !== (order.deliveryPhone ?? '') : order.deliveryPhone !== null) body.phone = phone || null;
  const cents = feeCents(form.fee);
  if (cents !== null && cents !== Math.round(Number(order.deliveryFee) * 100)) body.fee = cents / 100;
  return body;
}

export function formFrom(order: DeliveryOrder | null): DeliveryForm {
  return {
    recipient: order?.recipient ?? '',
    address: order?.deliveryAddress ?? '',
    phone: formatPhone(order?.deliveryPhone ?? null),
    fee: order ? feeFromCents(Math.round(Number(order.deliveryFee) * 100)) : '0,00',
    customerId: order?.customerId ?? null,
  };
}

// RF-01: lista da situação escolhida; "ativos" é o padrão da API.
export function listPath(filter: DeliveryFilter): string {
  return filter === 'ativos' ? '/delivery-orders' : `/delivery-orders?status=${filter}`;
}

// RN-03: dados só mudam com pedido aberto e ainda recebido.
export const canEdit = (order: DeliveryOrder) => order.status === 'OPEN' && order.deliveryStatus === 'RECEIVED';
export const canPay = (order: DeliveryOrder) => order.status === 'OPEN';
export const canCancel = (order: DeliveryOrder) => order.status === 'OPEN';
export const canDispatch = (order: DeliveryOrder) => order.status === 'OPEN' && order.deliveryStatus === 'RECEIVED';
export const canDeliver = (order: DeliveryOrder) => order.status === 'OPEN' && order.deliveryStatus === 'OUT_FOR_DELIVERY';

// RN-02: a situação mostrada prioriza o cancelamento da comanda.
export function situationOf(order: DeliveryOrder): DeliveryStatus {
  return order.status === 'CANCELLED' ? 'CANCELLED' : order.deliveryStatus;
}

export function situationLabel(order: DeliveryOrder): string {
  return STATUS_LABELS[situationOf(order)];
}

export function itemCount(order: DeliveryOrder): number {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

export type DeliverySummary = { count: number; received: number; outForDelivery: number; totalCents: number };

export function summarize(orders: readonly DeliveryOrder[]): DeliverySummary {
  const summary: DeliverySummary = { count: orders.length, received: 0, outForDelivery: 0, totalCents: 0 };
  for (const order of orders) {
    if (order.deliveryStatus === 'RECEIVED') summary.received += 1;
    if (order.deliveryStatus === 'OUT_FOR_DELIVERY') summary.outForDelivery += 1;
    summary.totalCents += Math.round(Number(order.total) * 100);
  }
  return summary;
}

// RF-08: data e hora no padrão brasileiro.
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

// RF-04: rota de lançamento de item do pedido.
export const itemPath = (orderId: number) => `/delivery-orders/${orderId}/items`;
