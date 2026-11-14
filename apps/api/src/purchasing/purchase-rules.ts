import { BadRequestException } from '@nestjs/common';

// Regras puras de compras e contas a pagar (SPEC/2026-11-13-fornecedores-e-contas-a-pagar.md).
// Dinheiro em centavos inteiros e quantidades em milésimos inteiros (RNF-01).

export type PurchaseStatus = 'OPEN' | 'PAID' | 'CANCELLED';
export type PayableSituation = 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING';

export const MAX_PURCHASE_ITEMS = 50;
export const COST_MESSAGE = 'Informe um custo unitário maior que zero com até 2 casas decimais.';
const DAY = 24 * 60 * 60 * 1000;

// RN-04: custo maior que zero com até 2 casas.
export function positiveCents(value: number | string | { toString(): string }, message = COST_MESSAGE): number {
  const number = Number(typeof value === 'number' ? value : value.toString());
  const cents = Math.round(number * 100);
  if (!Number.isFinite(number) || Math.abs(number * 100 - cents) > 1e-6 || cents <= 0) {
    throw new BadRequestException(message);
  }
  return cents;
}

// Centavos para o texto aceito pelo Decimal do Prisma: 12345 -> "123.45".
export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

// RN-05: quantidade (milésimos) × custo (centavos), arredondado para o centavo mais próximo.
export function lineTotalCents(quantityMilli: number, unitCostCents: number): number {
  return Math.floor((quantityMilli * unitCostCents + 500) / 1000);
}

export function purchaseTotalCents(lines: { quantityMilli: number; unitCostCents: number }[]): number {
  return lines.reduce((total, line) => total + lineTotalCents(line.quantityMilli, line.unitCostCents), 0);
}

// RN-04: de 1 a 50 itens.
export function assertItemCount(count: number): void {
  if (count < 1 || count > MAX_PURCHASE_ITEMS) {
    throw new BadRequestException(`A compra precisa ter de 1 a ${MAX_PURCHASE_ITEMS} itens.`);
  }
}

// RN-01: CPF ou CNPJ opcional, guardado só com dígitos.
export function normalizeDocument(value: string | undefined | null): string | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  if (!/^[\d.\-/\s]+$/.test(value)) throw new BadRequestException('CPF ou CNPJ inválido.');
  const digits = value.replace(/\D/g, '');
  if (!isValidCpf(digits) && !isValidCnpj(digits)) throw new BadRequestException('CPF ou CNPJ inválido.');
  return digits;
}

function checkDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const first = checkDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(digits[9]) && second === Number(digits[10]);
}

export function isValidCnpj(digits: string): boolean {
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;
  const first = checkDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(digits[12]) && second === Number(digits[13]);
}

// Início do dia em UTC (mesma convenção do restante da API).
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// RN-06: compra não pode ter data futura e não vence antes da data da compra.
export function assertPurchaseDates(purchasedAt: Date, dueDate: Date, today: Date): void {
  if (purchasedAt.getTime() > today.getTime()) {
    throw new BadRequestException('A data da compra não pode ser futura.');
  }
  if (dueDate.getTime() < purchasedAt.getTime()) {
    throw new BadRequestException('O vencimento não pode ser antes da data da compra.');
  }
}

// RN-11: pagamento entre a data da compra e hoje.
export function assertPaymentDate(paidAt: Date, purchasedAt: Date, today: Date): void {
  if (paidAt.getTime() > today.getTime()) {
    throw new BadRequestException('A data do pagamento não pode ser futura.');
  }
  if (paidAt.getTime() < purchasedAt.getTime()) {
    throw new BadRequestException('O pagamento não pode ser antes da data da compra.');
  }
}

// RN-08
export function assertOpen(status: PurchaseStatus): void {
  if (status !== 'OPEN') throw new BadRequestException('Só compras em aberto podem ser pagas ou canceladas.');
}

// RN-09: só cancela se o estoque ainda cobre o que entrou.
export function assertCanReverse(stockMilli: number, quantityMilli: number, ingredientName: string): void {
  if (stockMilli < quantityMilli) {
    throw new BadRequestException(`Não é possível cancelar: o estoque de ${ingredientName} já foi usado.`);
  }
}

// RN-07
export function payableSituation(dueDate: Date, today: Date): PayableSituation {
  if (dueDate.getTime() < today.getTime()) return 'OVERDUE';
  if (dueDate.getTime() === today.getTime()) return 'DUE_TODAY';
  return 'UPCOMING';
}

// RF-07: "próximos 7 dias" = hoje e os 6 dias seguintes.
export function summarizePayables(payables: { dueDate: Date; totalCents: number }[], today: Date) {
  const limit = today.getTime() + 7 * DAY;
  let openCents = 0;
  let overdueCents = 0;
  let dueNext7DaysCents = 0;
  for (const payable of payables) {
    const due = payable.dueDate.getTime();
    openCents += payable.totalCents;
    if (due < today.getTime()) overdueCents += payable.totalCents;
    else if (due < limit) dueNext7DaysCents += payable.totalCents;
  }
  return { count: payables.length, openCents, overdueCents, dueNext7DaysCents };
}
