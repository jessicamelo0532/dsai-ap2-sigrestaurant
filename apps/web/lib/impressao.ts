// Impressão de bobina e cupom (SPEC/2026-11-17-impressao-de-cupom.md).
// Funções puras: recebem a comanda como a tela já tem e montam o papel.

import { money, orderTotal } from './format';
import type { Order } from './types';

export const RESTAURANT_NAME = 'Mesa Clara';
export const RESTAURANT_SUBTITLE = 'Gestão do restaurante';

export const paymentLabels: Record<string, string> = {
  CASH: 'Dinheiro',
  CREDIT: 'Crédito',
  DEBIT: 'Débito',
  PIX: 'Pix',
  MIXED: 'Misto',
};

// RN-02: forma de pagamento por extenso; desconhecida sai como veio.
export function paymentLabel(method?: string | null): string {
  if (!method) return 'Não informada';
  return paymentLabels[method] ?? method;
}

export function tableName(number: number): string {
  return `Mesa ${String(number).padStart(2, '0')}`;
}

// Data e hora no fuso do aparelho, no formato brasileiro (sem depender de locale do servidor).
export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

export type PrintLine = { quantity: number; name: string; unitPrice: string; total: string };

// RN-03: o preço vem do servidor; a bobina não recalcula nada além do subtotal da linha.
export function printLines(order: Order): PrintLine[] {
  return order.items.map((line) => ({
    quantity: line.quantity,
    name: line.nameSnapshot,
    unitPrice: money(line.unitPrice),
    total: money(Number(line.unitPrice) * line.quantity),
  }));
}

export type Bobina = {
  kind: 'bobina';
  restaurant: string;
  subtitle: string;
  title: string;
  table: string;
  openedAt: string;
  lines: PrintLine[];
  itemCount: number;
  total: string;
  note: string | null;
};

// RF-01
export function buildBobina(order: Order, note?: string | null): Bobina {
  return {
    kind: 'bobina',
    restaurant: RESTAURANT_NAME,
    subtitle: RESTAURANT_SUBTITLE,
    title: 'COMANDA',
    table: tableName(order.tableNumber),
    openedAt: formatDateTime(order.openedAt),
    lines: printLines(order),
    itemCount: order.items.reduce((total, line) => total + line.quantity, 0),
    total: money(orderTotal(order)),
    note: note?.trim() ? note.trim() : null,
  };
}

export type Cupom = {
  kind: 'cupom';
  restaurant: string;
  subtitle: string;
  title: string;
  table: string;
  lines: PrintLine[];
  total: string;
  payment: string;
  paidAt: string;
  orderId: number;
};

// RF-02
export function buildCupom(order: Order): Cupom {
  return {
    kind: 'cupom',
    restaurant: RESTAURANT_NAME,
    subtitle: RESTAURANT_SUBTITLE,
    title: 'CONTA FECHADA',
    table: tableName(order.tableNumber),
    lines: printLines(order),
    total: money(orderTotal(order)),
    payment: paymentLabel(order.paymentMethod),
    paidAt: formatDateTime(order.paidAt),
    orderId: order.id,
  };
}

export function itemCountLabel(count: number): string {
  return count === 1 ? '1 item' : `${count} itens`;
}
