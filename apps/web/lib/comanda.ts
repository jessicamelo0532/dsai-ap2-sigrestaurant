// Atendimento na comanda: garçom, cliente e pontos (SPEC/2026-11-17-atendimento-na-comanda.md).
// Funções puras: recebem os dados como a API devolve e preparam o bloco Atendimento.
import { orderTotalCents } from './format';
import type { Order } from './types';

export type WaiterOption = { id: number; name: string; active: boolean };
export type CustomerOption = { id: number; name: string; phone: string | null; active?: boolean };
export type LoyaltyRule = { pointsPerReal: number; centsPerPoint: number; minRedeemPoints: number };

const reais = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const thousands = (value: number) => value.toLocaleString('pt-BR');

// RN-01: só ativos para escolher; o atual continua na lista mesmo se foi desativado depois (RF-02).
export function waiterChoices(waiters: readonly WaiterOption[], currentId: number | null | undefined): WaiterOption[] {
  return waiters
    .filter((waiter) => waiter.active || waiter.id === currentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export const subtotalCents = (order: Order) => orderTotalCents(order);

export function discountCents(order: Pick<Order, 'discount'>): number {
  return order.discount ? Math.round(Number(order.discount) * 100) : 0;
}

// RN-05: nunca negativo.
export function dueCents(order: Order): number {
  return Math.max(0, subtotalCents(order) - discountCents(order));
}

export const hasRedemption = (order: Pick<Order, 'loyaltyPoints'>) => (order.loyaltyPoints ?? 0) > 0;

// Inteiro positivo digitado; qualquer outra coisa é NaN.
export function parsePoints(raw: string): number {
  const text = raw.trim().replace(/\./g, '');
  return /^\d+$/.test(text) ? Number(text) : Number.NaN;
}

export const redeemDiscountCents = (points: number, rule: Pick<LoyaltyRule, 'centsPerPoint'>) => points * rule.centsPerPoint;

// RN-02 e RN-03, com as mensagens da API.
export function validateRedeem(points: number, context: { balance: number; subtotalCents: number; rule: LoyaltyRule }): string | null {
  const { balance, subtotalCents: subtotal, rule } = context;
  if (!Number.isInteger(points) || points < rule.minRedeemPoints) return `Resgate pelo menos ${thousands(rule.minRedeemPoints)} pontos.`;
  if (points > balance) return `Saldo insuficiente: o cliente tem ${thousands(balance)} pontos.`;
  const discount = redeemDiscountCents(points, rule);
  if (discount > subtotal) return `O desconto de ${reais(discount)} passa do total da comanda (${reais(subtotal)}).`;
  return null;
}

// Maior resgate possível: o saldo, limitado ao que o subtotal comporta. Zero se não alcança o mínimo.
export function maxRedeemablePoints(balance: number, subtotal: number, rule: LoyaltyRule): number {
  const bySubtotal = Math.floor(subtotal / rule.centsPerPoint);
  const max = Math.min(balance, bySubtotal);
  return max >= rule.minRedeemPoints ? max : 0;
}

export function redeemPreview(points: number, rule: Pick<LoyaltyRule, 'centsPerPoint'>): string {
  if (!Number.isInteger(points) || points <= 0) return '';
  return `${thousands(points)} pontos viram ${reais(redeemDiscountCents(points, rule))} de desconto.`;
}

export function customerLabel(customer: Pick<CustomerOption, 'name' | 'phone'>): string {
  return customer.phone ? `${customer.name} · ${customer.phone}` : customer.name;
}
