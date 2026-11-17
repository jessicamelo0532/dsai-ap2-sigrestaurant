import { describe, expect, it } from 'vitest';
import { assertOpenReceivable, dueDate, MESSAGES, parseDay, receiptDate, receivableNotes, statusFilter } from '../src/receivables/receivable-rules';

// SPEC/2026-11-17-contas-a-receber.md (T-01)
const today = new Date('2026-11-17T15:30:00.000Z');

describe('dia AAAA-MM-DD', () => {
  it('lê dias válidos e recusa os inválidos', () => {
    expect(parseDay('2026-11-17')?.toISOString()).toBe('2026-11-17T00:00:00.000Z');
    expect(parseDay('2026-02-30')).toBeNull();
    expect(parseDay('17/11/2026')).toBeNull();
    expect(parseDay(20261117)).toBeNull();
  });
});

describe('RN-03: vencimento (P-1)', () => {
  it('aceita de hoje até 365 dias', () => {
    expect(dueDate('2026-11-17', today).toISOString().slice(0, 10)).toBe('2026-11-17');
    expect(dueDate('2027-11-17', today).toISOString().slice(0, 10)).toBe('2027-11-17');
  });

  it('recusa formato, passado e mais de 365 dias', () => {
    expect(() => dueDate('17/12/2026', today)).toThrow(MESSAGES.dueFormat);
    expect(() => dueDate(undefined, today)).toThrow(MESSAGES.dueFormat);
    expect(() => dueDate('2026-11-16', today)).toThrow(MESSAGES.duePast);
    expect(() => dueDate('2027-11-18', today)).toThrow(MESSAGES.dueFar);
  });
});

describe('RN-04: observação', () => {
  it('limpa espaços, vazio vira nulo e limita 200 caracteres', () => {
    expect(receivableNotes('  paga   na sexta ')).toBe('paga na sexta');
    expect(receivableNotes('')).toBeNull();
    expect(receivableNotes(undefined)).toBeNull();
    expect(() => receivableNotes('x'.repeat(201))).toThrow(MESSAGES.notes);
  });
});

describe('RN-06: baixa', () => {
  const issuedAt = new Date('2026-11-10T00:00:00.000Z');

  it('data padrão é hoje; aceita entre a venda e hoje', () => {
    expect(receiptDate(undefined, issuedAt, today).toISOString().slice(0, 10)).toBe('2026-11-17');
    expect(receiptDate('2026-11-10', issuedAt, today).toISOString().slice(0, 10)).toBe('2026-11-10');
  });

  it('recusa futura, antes da venda e formato inválido', () => {
    expect(() => receiptDate('2026-11-18', issuedAt, today)).toThrow(MESSAGES.receivedFuture);
    expect(() => receiptDate('2026-11-09', issuedAt, today)).toThrow(MESSAGES.receivedBeforeSale);
    expect(() => receiptDate('ontem', issuedAt, today)).toThrow('Informe a data do recebimento no formato AAAA-MM-DD.');
  });

  it('só título aberto recebe baixa', () => {
    expect(() => assertOpenReceivable('OPEN')).not.toThrow();
    expect(() => assertOpenReceivable('PAID')).toThrow(MESSAGES.received);
  });
});

describe('filtro da lista', () => {
  it('aceita OPEN e PAID; o resto é todos', () => {
    expect(statusFilter('OPEN')).toBe('OPEN');
    expect(statusFilter('PAID')).toBe('PAID');
    expect(statusFilter('x')).toBeUndefined();
    expect(statusFilter(undefined)).toBeUndefined();
  });
});
