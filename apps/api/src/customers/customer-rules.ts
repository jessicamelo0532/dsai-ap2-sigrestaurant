// Regras puras de clientes (SPEC/2026-11-16-clientes-e-historico.md).
import { BadRequestException } from '@nestjs/common';
import { averageTicketCents } from '../closings/closing-rules';
import { centsToDecimal } from '../purchasing/purchase-rules';

export const NAME_MESSAGE = 'Informe o nome do cliente, de 2 a 80 caracteres.';
export const PHONE_MESSAGE = 'Informe o telefone com DDD, com 10 ou 11 dígitos.';
export const NOTES_MESSAGE = 'A observação deve ter até 300 caracteres.';
export const DUPLICATE_MESSAGE = 'Já existe cliente com esse nome e telefone.';
export const TOP_ITEMS = 3;

// RN-01: espaços repetidos viram um só.
export function customerName(value: unknown) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 80) throw new BadRequestException(NAME_MESSAGE);
  return name;
}

// RN-04: chave de comparação sem maiúsculas, acentos e espaços extras.
export function nameKey(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// RN-02 e P-1: só dígitos, sem o +55 do começo.
export function customerPhone(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new BadRequestException(PHONE_MESSAGE);
  const raw = value.trim();
  if (!raw) return null;
  if (!/^[\d\s().+-]+$/.test(raw)) throw new BadRequestException(PHONE_MESSAGE);
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+55') || (digits.length > 11 && digits.startsWith('55'))) digits = digits.slice(2);
  if (digits.length < 10 || digits.length > 11) throw new BadRequestException(PHONE_MESSAGE);
  return digits;
}

// RN-03
export function customerNotes(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new BadRequestException(NOTES_MESSAGE);
  const notes = value.trim();
  if (notes.length > 300) throw new BadRequestException(NOTES_MESSAGE);
  return notes || null;
}

// RN-04 e RNF-01: chave única de nome e telefone; sem telefone também conta.
export function dedupeKey(name: string, phone: string | null) {
  return `${nameKey(name)}|${phone ?? ''}`;
}

// RF-02: o termo de busca vale para nome (sem acento) e para telefone (só dígitos).
export function searchTerms(value: unknown) {
  if (typeof value !== 'string') return null;
  const name = nameKey(value);
  if (!name) return null;
  const digits = value.replace(/\D/g, '');
  return { name, digits: digits.length >= 2 ? digits : null };
}

export interface PaidOrder {
  id: number;
  paidAt: Date;
  tableNumber: number;
  totalCents: number;
  items: { name: string; quantity: number }[];
}

// RF-05, RN-07 e RN-08
export function customerHistory(orders: readonly PaidOrder[]) {
  const sorted = [...orders].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime() || a.id - b.id);
  const totalCents = sorted.reduce((sum, order) => sum + order.totalCents, 0);
  const quantities = new Map<string, number>();
  for (const order of sorted) {
    for (const item of order.items) quantities.set(item.name, (quantities.get(item.name) ?? 0) + item.quantity);
  }
  const favorites = [...quantities.entries()]
    .sort(([nameA, qtyA], [nameB, qtyB]) => qtyB - qtyA || nameA.localeCompare(nameB, 'pt-BR'))
    .slice(0, TOP_ITEMS)
    .map(([name, quantity]) => ({ name, quantity }));
  return {
    visits: sorted.length,
    totalSpent: centsToDecimal(totalCents),
    averageTicket: centsToDecimal(averageTicketCents(totalCents, sorted.length)),
    firstVisit: sorted[0]?.paidAt ?? null,
    lastVisit: sorted[sorted.length - 1]?.paidAt ?? null,
    favorites,
    orders: sorted
      .map((order) => ({ id: order.id, paidAt: order.paidAt, tableNumber: order.tableNumber, total: centsToDecimal(order.totalCents) }))
      .reverse(),
  };
}
