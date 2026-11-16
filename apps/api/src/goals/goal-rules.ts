// Regras puras de metas e comparativo (SPEC/2026-11-16-metas-de-vendas.md).
import { BadRequestException } from '@nestjs/common';
import { averageTicketCents, MonthRange, parseMonth, previousMonth, variation } from '../closings/closing-rules';

export interface GoalValues {
  revenueCents: number | null;
  orders: number | null;
  averageTicketCents: number | null;
}

export interface Summary {
  revenueCents: number;
  orders: number;
  averageTicketCents: number;
}

export interface Window {
  start: Date;
  end: Date;
}

function positiveCents(value: unknown, message: string): number | null {
  if (value === null || value === undefined) return null;
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  const cents = Math.round(number * 100);
  if (!Number.isFinite(number) || Math.abs(number * 100 - cents) > 1e-6 || cents <= 0) throw new BadRequestException(message);
  return cents;
}

// RF-01 e RN-02
export function parseGoal(input: { revenue?: unknown; orders?: unknown; averageTicket?: unknown }): GoalValues {
  const revenueCents = positiveCents(input.revenue, 'Informe uma meta de receita válida.');
  const averageTicket = positiveCents(input.averageTicket, 'Informe uma meta de ticket médio válida.');
  let orders: number | null = null;
  if (input.orders !== null && input.orders !== undefined) {
    if (typeof input.orders !== 'number' || !Number.isInteger(input.orders) || input.orders <= 0) {
      throw new BadRequestException('Informe uma meta de comandas válida.');
    }
    orders = input.orders;
  }
  if (revenueCents === null && orders === null && averageTicket === null) {
    throw new BadRequestException('Informe pelo menos uma meta: receita, comandas ou ticket médio.');
  }
  return { revenueCents, orders, averageTicketCents: averageTicket };
}

// RN-03
export function attainment(actual: number, goal: number | null): number | null {
  if (goal === null || goal <= 0) return null;
  return Math.round((actual / goal) * 1000) / 10;
}

// RN-05: do dia 1 até agora, sem passar do fim do mês; mês futuro fica vazio.
export function monthWindow(range: MonthRange, now: Date): Window {
  const end = Math.min(Math.max(now.getTime(), range.start.getTime()), range.end.getTime());
  return { start: range.start, end: new Date(end) };
}

// RN-06 e P-1: mesmo tamanho a partir do dia 1 do mês anterior, sem passar do fim dele.
export function previousMonthWindow(range: MonthRange, current: Window): Window {
  const previous = parseMonth(previousMonth(range.month));
  const length = current.end.getTime() - current.start.getTime();
  return { start: previous.start, end: new Date(Math.min(previous.start.getTime() + length, previous.end.getTime())) };
}

// RN-07: mesmo tamanho, terminando onde o período pedido começa.
export function previousPeriod(current: Window): Window {
  const length = current.end.getTime() - current.start.getTime();
  return { start: new Date(current.start.getTime() - length), end: current.start };
}

export function summarize(orderTotalsCents: readonly number[]): Summary {
  const revenueCents = orderTotalsCents.reduce((sum, total) => sum + total, 0);
  return { revenueCents, orders: orderTotalsCents.length, averageTicketCents: averageTicketCents(revenueCents, orderTotalsCents.length) };
}

// RN-08
export function compare(current: Summary, previous: Summary) {
  return {
    revenue: variation(current.revenueCents, previous.revenueCents),
    orders: variation(current.orders, previous.orders),
    averageTicket: variation(current.averageTicketCents, previous.averageTicketCents),
  };
}

// RF-02 e RN-03
export function goalAttainment(actual: Summary, goal: GoalValues | null) {
  return {
    revenue: attainment(actual.revenueCents, goal?.revenueCents ?? null),
    orders: attainment(actual.orders, goal?.orders ?? null),
    averageTicket: attainment(actual.averageTicketCents, goal?.averageTicketCents ?? null),
  };
}
