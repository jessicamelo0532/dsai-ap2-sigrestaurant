import { BadRequestException } from '@nestjs/common';

// Regras puras do fechamento mensal (SPEC/2026-11-16-fechamento-mensal.md).
// Dinheiro em centavos inteiros (RNF-01). Mês em UTC (P-4).

export type MonthRange = { month: string; label: string; start: Date; end: Date };

export type Dre = {
  revenueCents: number;
  paymentsCents: { CASH: number; CREDIT: number; DEBIT: number; PIX: number };
  purchasesCents: number;
  otherExpensesCents: number;
  expensesCents: number;
  resultCents: number;
  paidOrders: number;
  averageTicketCents: number;
};

// RN-01
export function parseMonth(value: string | undefined): MonthRange {
  const match = value === undefined ? null : /^(\d{4})-(\d{2})$/.exec(value);
  const monthIndex = match ? Number(match[2]) - 1 : -1;
  if (!match || monthIndex < 0 || monthIndex > 11) {
    throw new BadRequestException('Informe o mês no formato AAAA-MM.');
  }
  const year = Number(match[1]);
  return {
    month: value!,
    label: `${match[2]}/${match[1]}`,
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

// Mês (AAAA-MM) de uma data, em UTC.
export function monthOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function previousMonth(month: string): string {
  const { start } = parseMonth(month);
  return monthOf(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1)));
}

// RN-06: só fecha mês já encerrado.
export function assertMonthEnded(range: MonthRange, now: Date): void {
  if (now.getTime() < range.end.getTime()) {
    throw new BadRequestException('Só é possível fechar um mês que já terminou.');
  }
}

// RN-04
export function averageTicketCents(revenueCents: number, paidOrders: number): number {
  return paidOrders > 0 ? Math.round(revenueCents / paidOrders) : 0;
}

// RN-05: variação percentual com uma casa; sem base, nula.
export function variation(currentCents: number, previousCents: number): number | null {
  if (previousCents === 0) return null;
  return Math.round(((currentCents - previousCents) / Math.abs(previousCents)) * 1000) / 10;
}

// RN-02 a RN-04: monta a DRE a partir das comandas pagas e das despesas do mês.
export function buildDre(
  paidOrders: { paymentMethod: keyof Dre['paymentsCents']; totalCents: number }[],
  expenses: { amountCents: number; fromPurchase: boolean }[],
): Dre {
  const paymentsCents = { CASH: 0, CREDIT: 0, DEBIT: 0, PIX: 0 };
  for (const order of paidOrders) paymentsCents[order.paymentMethod] += order.totalCents;
  const revenueCents = paidOrders.reduce((total, order) => total + order.totalCents, 0);
  const purchasesCents = expenses.filter((expense) => expense.fromPurchase).reduce((total, expense) => total + expense.amountCents, 0);
  const otherExpensesCents = expenses.filter((expense) => !expense.fromPurchase).reduce((total, expense) => total + expense.amountCents, 0);
  const expensesCents = purchasesCents + otherExpensesCents;
  return {
    revenueCents,
    paymentsCents,
    purchasesCents,
    otherExpensesCents,
    expensesCents,
    resultCents: revenueCents - expensesCents,
    paidOrders: paidOrders.length,
    averageTicketCents: averageTicketCents(revenueCents, paidOrders.length),
  };
}

// RN-09: campos em que o valor guardado difere do recalculado.
export function divergences(stored: Dre, current: Dre): string[] {
  const fields: [string, number, number][] = [
    ['revenue', stored.revenueCents, current.revenueCents],
    ['cash', stored.paymentsCents.CASH, current.paymentsCents.CASH],
    ['credit', stored.paymentsCents.CREDIT, current.paymentsCents.CREDIT],
    ['debit', stored.paymentsCents.DEBIT, current.paymentsCents.DEBIT],
    ['pix', stored.paymentsCents.PIX, current.paymentsCents.PIX],
    ['purchases', stored.purchasesCents, current.purchasesCents],
    ['otherExpenses', stored.otherExpensesCents, current.otherExpensesCents],
    ['result', stored.resultCents, current.resultCents],
    ['paidOrders', stored.paidOrders, current.paidOrders],
    ['averageTicket', stored.averageTicketCents, current.averageTicketCents],
  ];
  return fields.filter(([, before, after]) => before !== after).map(([name]) => name);
}

// RN-08
export function assertReopenReason(reason: string | undefined): string {
  const text = (reason ?? '').trim();
  if (text.length < 5 || text.length > 300) {
    throw new BadRequestException('Informe o motivo da reabertura, de 5 a 300 caracteres.');
  }
  return text;
}

// RN-07
export function closedMonthMessage(month: string): string {
  return `O mês ${parseMonth(month).label} está fechado. Reabra o fechamento para alterar lançamentos desse mês.`;
}
