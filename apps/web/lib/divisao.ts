// Divisão de conta por consumidor (SPEC/2026-11-19-divisao-de-conta.md).
// Funções puras: a tela monta as parcelas; o local-store persiste e fecha a comanda.

import { dueCents, subtotalCents } from './comanda';
import type { Order, OrderSplit } from './types';

export const SPLIT_MODES = ['EQUAL', 'ITEM', 'VALUE'] as const;
export type SplitMode = typeof SPLIT_MODES[number];

export const SPLIT_MIN_PEOPLE = 2;
export const SPLIT_MAX_PEOPLE = 50;
export const SPLIT_NAME_ERROR = 'Informe um nome para cada pessoa.';
export const SPLIT_VALUE_ERROR = 'Informe um valor maior que zero para cada parcela.';
export const SPLIT_SUM_ERROR = 'A soma das parcelas precisa ser igual ao total da comanda.';
export const SPLIT_ITEM_ERROR = 'Atribua todos os itens da comanda a uma pessoa.';
export const SPLIT_DUPLICATE_ITEM = 'Cada item só pode ficar com uma pessoa.';
export const SPLIT_EMPTY_PERSON = 'Cada pessoa precisa de pelo menos um item.';
export const SPLIT_LOCKED = 'Cancele a divisão antes de alterar os itens da comanda.';

export type SplitDraft = { name: string; amount: string; items?: { itemId: number; quantity: number }[] };

export function parseCents(value: string | number): number {
  const text = String(value).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return Number.NaN;
  return Math.round(Number(text) * 100);
}

export function moneyDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function defaultNames(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Pessoa ${index + 1}`);
}

export function modeLabel(mode: SplitMode): string {
  return mode === 'EQUAL' ? 'Por igual' : mode === 'ITEM' ? 'Por item' : 'Por valor';
}

export function validatePeople(count: number): string | null {
  return Number.isInteger(count) && count >= SPLIT_MIN_PEOPLE && count <= SPLIT_MAX_PEOPLE
    ? null
    : `Informe de ${SPLIT_MIN_PEOPLE} a ${SPLIT_MAX_PEOPLE} pessoas.`;
}

// RN-01: divide o total em centavos; a última parcela recebe o resto.
export function splitEqual(totalCents: number, count: number, names?: string[]): SplitDraft[] {
  const invalid = validatePeople(count);
  if (invalid) throw new Error(invalid);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) => ({
    name: names?.[index]?.trim() || defaultNames(count)[index],
    amount: moneyDecimal(index === count - 1 ? base + remainder : base),
  }));
}

// RN-02: cada linha da comanda fica inteira com uma pessoa; o desconto é rateado
// proporcionalmente para a soma das parcelas fechar no total a pagar.
export function splitByItem(order: Order, assignments: { name: string; itemIds: number[] }[]): SplitDraft[] {
  if (!order.items.length) throw new Error('Adicione itens antes de dividir a conta.');
  const seen = new Set<number>();
  for (const assignment of assignments) {
    for (const itemId of assignment.itemIds) {
      if (seen.has(itemId)) throw new Error(SPLIT_DUPLICATE_ITEM);
      seen.add(itemId);
    }
  }
  for (const item of order.items) {
    if (!seen.has(item.id)) throw new Error(SPLIT_ITEM_ERROR);
  }

  const subtotal = subtotalCents(order);
  const due = dueCents(order);
  const discount = subtotal - due;
  const raw = assignments.map((assignment, index) => {
    const items = assignment.itemIds
      .map((itemId) => order.items.find((item) => item.id === itemId))
      .filter((item): item is Order['items'][number] => Boolean(item));
    const amount = items.reduce((total, item) => total + Math.round(Number(item.unitPrice) * 100) * item.quantity, 0);
    return {
      name: assignment.name.trim() || defaultNames(assignments.length)[index],
      items: items.map((item) => ({ itemId: item.id, quantity: item.quantity })),
      amount,
    };
  });
  if (raw.some((entry) => !entry.items.length)) throw new Error(SPLIT_EMPTY_PERSON);

  let allocated = 0;
  return raw.map((entry, index) => {
    const share = subtotal > 0 ? Math.floor((discount * entry.amount) / subtotal) : 0;
    const amount = index === raw.length - 1 ? due - allocated : entry.amount - share;
    allocated += amount;
    return { name: entry.name, amount: moneyDecimal(amount), items: entry.items };
  });
}

// RN-03: cada pessoa informa o valor; a soma precisa fechar no total.
export function splitByValue(values: { name: string; amount: string }[], totalCents: number): SplitDraft[] {
  const drafts = values.map((value) => ({
    name: value.name.trim(),
    amount: moneyDecimal(parseCents(value.amount)),
  }));
  const invalid = validateDrafts(drafts, totalCents);
  if (invalid) throw new Error(invalid);
  return drafts;
}

export function validateDrafts(drafts: readonly SplitDraft[], totalCents: number): string | null {
  if (drafts.length < SPLIT_MIN_PEOPLE || drafts.length > SPLIT_MAX_PEOPLE) {
    return `Informe de ${SPLIT_MIN_PEOPLE} a ${SPLIT_MAX_PEOPLE} pessoas.`;
  }
  if (drafts.some((draft) => !draft.name.trim())) return SPLIT_NAME_ERROR;
  let sum = 0;
  for (const draft of drafts) {
    const cents = parseCents(draft.amount);
    if (!Number.isFinite(cents) || cents <= 0) return SPLIT_VALUE_ERROR;
    sum += cents;
  }
  if (sum !== totalCents) return SPLIT_SUM_ERROR;
  return null;
}

export type SplitSummary = { count: number; paidCount: number; total: string; paid: string; remaining: string; allPaid: boolean };

export function splitSummary(splits: readonly OrderSplit[]): SplitSummary {
  const total = splits.reduce((sum, split) => sum + Math.round(Number(split.amount) * 100), 0);
  const paid = splits.filter((split) => split.paid).reduce((sum, split) => sum + Math.round(Number(split.amount) * 100), 0);
  return {
    count: splits.length,
    paidCount: splits.filter((split) => split.paid).length,
    total: moneyDecimal(total),
    paid: moneyDecimal(paid),
    remaining: moneyDecimal(total - paid),
    allPaid: splits.length > 0 && splits.every((split) => split.paid),
  };
}
