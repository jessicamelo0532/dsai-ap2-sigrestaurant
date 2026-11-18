import { BadRequestException } from '@nestjs/common';
import { startOfUtcDay } from '../purchasing/purchase-rules';

// Regras puras das contas a receber (SPEC/2026-11-17-contas-a-receber.md).
// Situação e resumo reaproveitam as regras das contas a pagar (RN-07).

const DAY = 24 * 60 * 60 * 1000;
export const MAX_DUE_DAYS = 365;
export const MAX_NOTES = 200;

export const MESSAGES = {
  customer: 'Informe o cliente para vender a prazo.',
  inactive: 'Este cliente está desativado.',
  dueFormat: 'Informe o vencimento no formato AAAA-MM-DD.',
  duePast: 'O vencimento não pode ser antes de hoje.',
  dueFar: `O vencimento pode ser de até ${MAX_DUE_DAYS} dias.`,
  notes: `A observação pode ter até ${MAX_NOTES} caracteres.`,
  received: 'Este título já foi recebido.',
  receivedFuture: 'A data do recebimento não pode ser futura.',
  receivedBeforeSale: 'O recebimento não pode ser antes da venda.',
  notFound: 'Título não encontrado.',
};

// Dia AAAA-MM-DD em UTC (como as datas das contas a pagar); inválido -> null.
export function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

// RN-03 (P-1): de hoje até 365 dias.
export function dueDate(value: unknown, today: Date): Date {
  const due = parseDay(value);
  if (!due) throw new BadRequestException(MESSAGES.dueFormat);
  const start = startOfUtcDay(today);
  if (due.getTime() < start.getTime()) throw new BadRequestException(MESSAGES.duePast);
  if (due.getTime() > start.getTime() + MAX_DUE_DAYS * DAY) throw new BadRequestException(MESSAGES.dueFar);
  return due;
}

// RN-04
export function receivableNotes(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (text.length > MAX_NOTES) throw new BadRequestException(MESSAGES.notes);
  return text || null;
}

// RN-06: só aberto; data entre a venda e hoje (padrão: hoje).
export function receiptDate(value: unknown, issuedAt: Date, today: Date): Date {
  const start = startOfUtcDay(today);
  const date = value === undefined || value === null || value === '' ? start : parseDay(value);
  if (!date) throw new BadRequestException('Informe a data do recebimento no formato AAAA-MM-DD.');
  if (date.getTime() > start.getTime()) throw new BadRequestException(MESSAGES.receivedFuture);
  if (date.getTime() < startOfUtcDay(issuedAt).getTime()) throw new BadRequestException(MESSAGES.receivedBeforeSale);
  return date;
}

export function assertOpenReceivable(status: 'OPEN' | 'PAID'): void {
  if (status !== 'OPEN') throw new BadRequestException(MESSAGES.received);
}

// RF-02: filtro da lista; vazio ou desconhecido = todos.
export function statusFilter(value: unknown): 'OPEN' | 'PAID' | undefined {
  return value === 'OPEN' || value === 'PAID' ? value : undefined;
}
