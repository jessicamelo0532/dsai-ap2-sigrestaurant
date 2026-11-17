import { BadRequestException } from '@nestjs/common';
import { averageTicketCents } from '../closings/closing-rules';

// Regras puras dos relatórios de vendas (SPEC/2026-11-16-relatorios-de-vendas.md).
// Dinheiro em centavos inteiros (RNF-01).

export type PaymentMethod = 'CASH' | 'CREDIT' | 'DEBIT' | 'PIX';
export type SaleLine = { key: string; name: string; category: string; quantity: number; unitPriceCents: number };
export type PaidSale = { paidAt: Date; paymentMethod: PaymentMethod; lines: SaleLine[] };
export type ItemStat = { name: string; category: string; quantity: number; revenueCents: number; share: number };

export const REMOVED_CATEGORY = 'Item removido do cardápio';
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;
// P-1: horário de Belém, UTC−3 sem horário de verão.
export const LOCAL_OFFSET_HOURS = -3;
export const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const METHODS: PaymentMethod[] = ['CASH', 'CREDIT', 'DEBIT', 'PIX'];
const HOUR = 60 * 60 * 1000;

// RN-06
export function parseLimit(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_LIMIT;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new BadRequestException(`Informe um limite de 1 a ${MAX_LIMIT} itens.`);
  }
  return limit;
}

// RN-05: hora e dia da semana do pagamento no horário local.
export function localSlot(date: Date): { hour: number; weekday: number } {
  const local = new Date(date.getTime() + LOCAL_OFFSET_HOURS * HOUR);
  return { hour: local.getUTCHours(), weekday: local.getUTCDay() };
}

// RNF-02: participação com uma casa decimal; sem total, zero.
export function share(partCents: number, totalCents: number): number {
  return totalCents === 0 ? 0 : Math.round((partCents / totalCents) * 1000) / 10;
}

// RN-02
const lineCents = (line: SaleLine) => line.unitPriceCents * line.quantity;
const saleCents = (sale: PaidSale) => sale.lines.reduce((total, line) => total + lineCents(line), 0);

// RN-03: agrupa pelo item de origem e pelo nome registrado na comanda.
function itemStats(sales: PaidSale[], revenueCents: number): ItemStat[] {
  const items = new Map<string, Omit<ItemStat, 'share'>>();
  for (const line of sales.flatMap((sale) => sale.lines)) {
    const item = items.get(line.key) ?? { name: line.name, category: line.category, quantity: 0, revenueCents: 0 };
    item.quantity += line.quantity;
    item.revenueCents += lineCents(line);
    items.set(line.key, item);
  }
  return [...items.values()].map((item) => ({ ...item, share: share(item.revenueCents, revenueCents) }));
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR');

// RF-03: por quantidade (empate: receita, depois nome) e por receita (empate: quantidade, depois nome).
export function rankByQuantity(items: ItemStat[]): ItemStat[] {
  return [...items].sort((a, b) => b.quantity - a.quantity || b.revenueCents - a.revenueCents || byName(a, b));
}

export function rankByRevenue(items: ItemStat[]): ItemStat[] {
  return [...items].sort((a, b) => b.revenueCents - a.revenueCents || b.quantity - a.quantity || byName(a, b));
}

// RF-02 a RF-07 e RN-07.
export function buildSalesReport(sales: PaidSale[], limit = DEFAULT_LIMIT) {
  const revenueCents = sales.reduce((total, sale) => total + saleCents(sale), 0);
  const items = itemStats(sales, revenueCents);

  const categories = new Map<string, { category: string; quantity: number; revenueCents: number; hours: number[] }>();
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenueCents: 0 }));
  const byWeekday = WEEKDAYS.map((label, weekday) => ({ weekday, label, orders: 0, revenueCents: 0 }));
  const byPayment = METHODS.map((method) => ({ method, orders: 0, revenueCents: 0 }));

  for (const sale of sales) {
    const { hour, weekday } = localSlot(sale.paidAt);
    const total = saleCents(sale);
    byHour[hour].orders += 1;
    byHour[hour].revenueCents += total;
    byWeekday[weekday].orders += 1;
    byWeekday[weekday].revenueCents += total;
    const payment = byPayment[METHODS.indexOf(sale.paymentMethod)];
    payment.orders += 1;
    payment.revenueCents += total;
    for (const line of sale.lines) {
      const category = categories.get(line.category)
        ?? { category: line.category, quantity: 0, revenueCents: 0, hours: Array<number>(24).fill(0) };
      category.quantity += line.quantity;
      category.revenueCents += lineCents(line);
      category.hours[hour] += lineCents(line);
      categories.set(line.category, category);
    }
  }

  const categoryList = [...categories.values()].sort(
    (a, b) => b.revenueCents - a.revenueCents || a.category.localeCompare(b.category, 'pt-BR'),
  );
  return {
    paidOrders: sales.length,
    revenueCents,
    itemsSold: items.reduce((total, item) => total + item.quantity, 0),
    averageTicketCents: averageTicketCents(revenueCents, sales.length),
    topByQuantity: rankByQuantity(items).slice(0, limit),
    topByRevenue: rankByRevenue(items).slice(0, limit),
    byCategory: categoryList.map(({ category, quantity, revenueCents: cents }) => ({
      category, quantity, revenueCents: cents, share: share(cents, revenueCents),
    })),
    byHour,
    byWeekday,
    byPayment: byPayment.map((payment) => ({ ...payment, share: share(payment.revenueCents, revenueCents) })),
    categoryByHour: categoryList.map(({ category, hours }) => ({ category, hours })),
  };
}
