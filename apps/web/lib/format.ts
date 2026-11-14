import type { Order } from './types';

export const money = (value: string | number) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function orderTotalCents(order: Order) {
  return order.items.reduce((total, line) => total + Math.round(Number(line.unitPrice) * 100) * line.quantity, 0);
}

export const orderTotal = (order: Order | null) => order ? orderTotalCents(order) / 100 : 0;

export const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
