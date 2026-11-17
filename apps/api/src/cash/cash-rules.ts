import { BadRequestException } from '@nestjs/common';

// Regras puras do caixa por turno (SPEC/2026-11-16-caixa-por-turno.md). Dinheiro em centavos (RNF-01).

export type Method = 'CASH' | 'CREDIT' | 'DEBIT' | 'PIX';
export type ByMethod = Record<Method, number>;
export const METHODS: Method[] = ['CASH', 'CREDIT', 'DEBIT', 'PIX'];

export const emptyByMethod = (): ByMethod => ({ CASH: 0, CREDIT: 0, DEBIT: 0, PIX: 0 });

// RN-02 e RN-08: valor em centavos com até 2 casas; "positive" exige maior que zero.
export function cents(value: number | string | undefined, message: string, positive = false): number {
  const number = Number(value);
  const result = Math.round(number * 100);
  const valid = value !== undefined && value !== '' && Number.isFinite(number) && Math.abs(number * 100 - result) <= 1e-6;
  if (!valid || result < 0 || (positive && result === 0)) throw new BadRequestException(message);
  return result;
}

// RN-02: texto obrigatório entre limites, sem espaços sobrando.
export function text(value: string | undefined, min: number, max: number, message: string): string {
  const trimmed = (value ?? '').trim();
  if (trimmed.length < min || trimmed.length > max) throw new BadRequestException(message);
  return trimmed;
}

// "R$ 1.234,56" para mensagens.
export function brl(valueCents: number): string {
  const sign = valueCents < 0 ? '-' : '';
  const absolute = Math.abs(valueCents);
  const reais = String(Math.floor(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}R$ ${reais},${String(absolute % 100).padStart(2, '0')}`;
}

// RN-03: vendas do turno somadas por forma de pagamento.
export function salesByMethod(sales: { method: Method; cents: number }[]): ByMethod {
  const totals = emptyByMethod();
  for (const sale of sales) totals[sale.method] += sale.cents;
  return totals;
}

// RN-04: dinheiro = troco + vendas em dinheiro + reforços − sangrias; demais formas = vendas.
export function expectedByMethod(
  openingCents: number,
  sales: ByMethod,
  movements: { type: 'WITHDRAWAL' | 'DEPOSIT'; cents: number }[],
): ByMethod {
  const deposits = movements.filter((movement) => movement.type === 'DEPOSIT').reduce((total, movement) => total + movement.cents, 0);
  const withdrawals = movements.filter((movement) => movement.type === 'WITHDRAWAL').reduce((total, movement) => total + movement.cents, 0);
  return { ...sales, CASH: openingCents + sales.CASH + deposits - withdrawals };
}

// RN-05: sangria não passa do dinheiro na gaveta.
export function assertWithdrawal(expectedCashCents: number, amountCents: number): void {
  if (amountCents > expectedCashCents) {
    throw new BadRequestException(`Saldo insuficiente no caixa: há ${brl(expectedCashCents)} em dinheiro.`);
  }
}

// RN-07: diferença = informado − esperado, por forma.
export function differences(expected: ByMethod, counted: ByMethod) {
  return METHODS.map((method) => ({
    method,
    expectedCents: expected[method],
    countedCents: counted[method],
    differenceCents: counted[method] - expected[method],
  }));
}

export const hasDivergence = (rows: { differenceCents: number }[]) => rows.some((row) => row.differenceCents !== 0);

// RN-07: com diferença, a observação é obrigatória.
export function closingNotes(divergent: boolean, notes: string | undefined): string | null {
  const trimmed = (notes ?? '').trim();
  if (divergent && (trimmed.length < 5 || trimmed.length > 500)) {
    throw new BadRequestException('Explique a diferença de caixa antes de fechar o turno.');
  }
  return trimmed || null;
}
