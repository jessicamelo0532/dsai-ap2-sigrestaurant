import { describe, expect, it } from 'vitest';
import {
  brl, closeBody, closingPreview, countedCents, differenceLabel, emptyCounted, formatDateTime, hasDifference,
  historyRange, parseMoneyInput, sessionStatusLabel, toCents, totalCents, validateCloseForm, validateMovementForm,
  validateOpenForm, type ByMethod,
} from './caixa';

const expected: ByMethod = { CASH: '230.00', CREDIT: '80.50', DEBIT: '0.00', PIX: '45.00' };

describe('parseMoneyInput (RN-04)', () => {
  it.each([
    ['12,50', 1250], ['12.50', 1250], ['12', 1200], ['0', 0], ['0,5', 50],
    ['1.234,56', 123456], ['R$ 1.234,56', 123456], [' 7,05 ', 705],
  ])('lê %s como %i centavos', (raw, cents) => {
    expect(parseMoneyInput(raw)).toBe(cents);
  });

  it.each(['', 'abc', '12,345', '-5', '1,2,3', '12.3.4'])('recusa %s', (raw) => {
    expect(parseMoneyInput(raw)).toBeNull();
  });
});

describe('dinheiro', () => {
  it('converte o texto da API para centavos sem erro de ponto flutuante', () => {
    expect(toCents('80.50')).toBe(8050);
    expect(toCents('0.29')).toBe(29);
    expect(toCents(null)).toBe(0);
  });

  it('formata em reais com milhar e sinal (RNF-01)', () => {
    expect(brl(123456)).toBe('R$ 1.234,56');
    expect(brl(5)).toBe('R$ 0,05');
    expect(brl(-1050)).toBe('-R$ 10,50');
  });

  it('soma as quatro formas', () => {
    expect(totalCents(expected)).toBe(35550);
  });
});

describe('abertura (RN-01)', () => {
  it('aceita operador e troco válidos, inclusive troco vazio', () => {
    expect(validateOpenForm({ operator: 'Ana', openingAmount: '150,00' })).toBeNull();
    expect(validateOpenForm({ operator: 'Ana', openingAmount: '' })).toBeNull();
  });

  it('recusa operador curto ou longo', () => {
    expect(validateOpenForm({ operator: ' A ', openingAmount: '10' })).toMatch(/operador/);
    expect(validateOpenForm({ operator: 'x'.repeat(81), openingAmount: '10' })).toMatch(/operador/);
  });

  it('recusa troco inválido', () => {
    expect(validateOpenForm({ operator: 'Ana', openingAmount: '10,999' })).toMatch(/troco/);
  });
});

describe('sangria e reforço (RN-01)', () => {
  it('aceita valor e motivo válidos', () => {
    expect(validateMovementForm('WITHDRAWAL', { amount: '50', reason: 'Depósito no banco' })).toBeNull();
  });

  it('recusa valor zero ou inválido com o nome da movimentação', () => {
    expect(validateMovementForm('WITHDRAWAL', { amount: '0', reason: 'Banco' })).toMatch(/da sangria/);
    expect(validateMovementForm('DEPOSIT', { amount: 'x', reason: 'Troco' })).toMatch(/do reforço/);
  });

  it('recusa motivo com menos de 3 ou mais de 200 caracteres', () => {
    expect(validateMovementForm('DEPOSIT', { amount: '10', reason: 'ab' })).toMatch(/motivo do reforço/);
    expect(validateMovementForm('DEPOSIT', { amount: '10', reason: 'a'.repeat(201) })).toMatch(/motivo/);
  });
});

describe('prévia do fechamento (RN-03)', () => {
  it('sem diferença quando o contado é o esperado', () => {
    const rows = closingPreview(expected, { CASH: '230', CREDIT: '80,50', DEBIT: '', PIX: '45' });
    expect(rows.map((row) => row.differenceCents)).toEqual([0, 0, 0, 0]);
    expect(hasDifference(rows)).toBe(false);
  });

  it('diferença = contado − esperado, por forma', () => {
    const rows = closingPreview(expected, { CASH: '220', CREDIT: '81', DEBIT: '0', PIX: '45' });
    expect(rows.find((row) => row.method === 'CASH')?.differenceCents).toBe(-1000);
    expect(rows.find((row) => row.method === 'CREDIT')?.differenceCents).toBe(50);
    expect(hasDifference(rows)).toBe(true);
  });

  it('campo vazio vale zero e texto inválido é null', () => {
    expect(countedCents('')).toBe(0);
    expect(countedCents('abc')).toBeNull();
  });

  it('descreve sobra, falta e conferência', () => {
    expect(differenceLabel(0)).toBe('Confere');
    expect(differenceLabel(50)).toBe('Sobra de R$ 0,50');
    expect(differenceLabel(-1000)).toBe('Falta de R$ 10,00');
  });
});

describe('validação do fechamento (RN-01 a RN-03)', () => {
  const exact = { CASH: '230', CREDIT: '80,50', DEBIT: '0', PIX: '45' };

  it('fecha sem observação quando confere', () => {
    expect(validateCloseForm({ operator: 'Ana', counted: exact, notes: '' }, expected)).toBeNull();
  });

  it('exige observação de 5 caracteres quando há diferença', () => {
    const counted = { ...exact, CASH: '229' };
    expect(validateCloseForm({ operator: 'Ana', counted, notes: '' }, expected))
      .toBe('Explique a diferença de caixa antes de fechar o turno.');
    expect(validateCloseForm({ operator: 'Ana', counted, notes: 'Troco' }, expected)).toBeNull();
  });

  it('recusa valor contado inválido citando a forma', () => {
    expect(validateCloseForm({ operator: 'Ana', counted: { ...exact, PIX: '4,555' }, notes: '' }, expected)).toMatch(/Pix/);
  });

  it('recusa operador inválido e observação longa', () => {
    expect(validateCloseForm({ operator: 'A', counted: exact, notes: '' }, expected)).toMatch(/operador/);
    expect(validateCloseForm({ operator: 'Ana', counted: exact, notes: 'x'.repeat(501) }, expected)).toMatch(/500/);
  });

  it('monta o corpo com números e sem observação vazia', () => {
    expect(closeBody({ operator: ' Ana ', counted: { ...emptyCounted(), CASH: '230', CREDIT: '80,50' }, notes: '  ' }))
      .toEqual({ operator: 'Ana', counted: { CASH: 230, CREDIT: 80.5, DEBIT: 0, PIX: 0 } });
    expect(closeBody({ operator: 'Ana', counted: exact, notes: ' Troco errado ' }).notes).toBe('Troco errado');
  });
});

describe('histórico (RF-06)', () => {
  it('cobre os últimos 30 dias, incluindo hoje', () => {
    expect(historyRange(new Date(2026, 10, 17))).toEqual({ from: '2026-10-19', to: '2026-11-17' });
  });

  it('rotula a situação do turno', () => {
    expect(sessionStatusLabel({ status: 'OPEN', divergent: false })).toBe('Aberto');
    expect(sessionStatusLabel({ status: 'CLOSED', divergent: true })).toBe('Fechado com diferença');
    expect(sessionStatusLabel({ status: 'CLOSED', divergent: false })).toBe('Fechado sem diferença');
  });

  it('formata data e hora no fuso do aparelho', () => {
    expect(formatDateTime(new Date(2026, 10, 17, 9, 5).toISOString())).toBe('17/11 09:05');
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('inválida')).toBe('—');
  });
});
