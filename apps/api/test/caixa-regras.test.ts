import { describe, expect, it } from 'vitest';
import {
  assertWithdrawal,
  brl,
  cents,
  closingNotes,
  differences,
  expectedByMethod,
  hasDivergence,
  salesByMethod,
  text,
} from '../src/cash/cash-rules';

describe('RN-02 e RN-08: valores e textos', () => {
  it('converte para centavos com até 2 casas', () => {
    expect(cents(100, 'erro')).toBe(10000);
    expect(cents('12.5', 'erro')).toBe(1250);
    expect(cents(0, 'erro')).toBe(0);
  });

  it.each([-1, 1.005, 'abc', undefined, ''])('recusa %s', (value) => {
    expect(() => cents(value, 'Valor inválido.')).toThrow('Valor inválido.');
  });

  it('quando exige positivo, recusa zero', () => {
    expect(() => cents(0, 'Maior que zero.', true)).toThrow('Maior que zero.');
    expect(cents(0.01, 'erro', true)).toBe(1);
  });

  it('texto entre limites, sem espaços sobrando', () => {
    expect(text('  Ana  ', 2, 80, 'erro')).toBe('Ana');
    expect(() => text('A', 2, 80, 'Operador inválido.')).toThrow('Operador inválido.');
    expect(() => text(undefined, 2, 80, 'Operador inválido.')).toThrow('Operador inválido.');
    expect(() => text('x'.repeat(81), 2, 80, 'Operador inválido.')).toThrow();
  });

  it('formata reais com milhar e vírgula', () => {
    expect(brl(123456)).toBe('R$ 1.234,56');
    expect(brl(5)).toBe('R$ 0,05');
    expect(brl(100000000)).toBe('R$ 1.000.000,00');
    expect(brl(-250)).toBe('-R$ 2,50');
  });
});

describe('RN-03 e RN-04: esperado no caixa', () => {
  const sales = salesByMethod([
    { method: 'CASH', cents: 4550 },
    { method: 'PIX', cents: 6000 },
    { method: 'CASH', cents: 1000 },
    { method: 'DEBIT', cents: 2500 },
  ]);

  it('soma as vendas por forma de pagamento', () => {
    expect(sales).toEqual({ CASH: 5550, CREDIT: 0, DEBIT: 2500, PIX: 6000 });
  });

  it('dinheiro = troco + vendas em dinheiro + reforços − sangrias; demais formas = vendas', () => {
    const expected = expectedByMethod(10000, sales, [
      { type: 'WITHDRAWAL', cents: 3000 },
      { type: 'DEPOSIT', cents: 500 },
      { type: 'WITHDRAWAL', cents: 1000 },
    ]);

    expect(expected).toEqual({ CASH: 10000 + 5550 + 500 - 4000, CREDIT: 0, DEBIT: 2500, PIX: 6000 });
  });
});

describe('RN-05: sangria', () => {
  it('permite tirar até o dinheiro esperado na gaveta', () => {
    expect(() => assertWithdrawal(5000, 5000)).not.toThrow();
  });

  it('recusa sangria maior que o dinheiro, citando o saldo', () => {
    expect(() => assertWithdrawal(5000, 5001)).toThrow('Saldo insuficiente no caixa: há R$ 50,00 em dinheiro.');
  });
});

describe('RN-07: diferenças e justificativa', () => {
  const expected = { CASH: 12050, CREDIT: 0, DEBIT: 2500, PIX: 6000 };

  it('diferença por forma: positiva é sobra, negativa é falta', () => {
    const rows = differences(expected, { CASH: 12000, CREDIT: 0, DEBIT: 2600, PIX: 6000 });

    expect(rows).toEqual([
      { method: 'CASH', expectedCents: 12050, countedCents: 12000, differenceCents: -50 },
      { method: 'CREDIT', expectedCents: 0, countedCents: 0, differenceCents: 0 },
      { method: 'DEBIT', expectedCents: 2500, countedCents: 2600, differenceCents: 100 },
      { method: 'PIX', expectedCents: 6000, countedCents: 6000, differenceCents: 0 },
    ]);
    expect(hasDivergence(rows)).toBe(true);
  });

  it('tudo igual não é divergência', () => {
    expect(hasDivergence(differences(expected, expected))).toBe(false);
  });

  it('com diferença, exige observação de 5 a 500 caracteres', () => {
    expect(() => closingNotes(true, undefined)).toThrow('Explique a diferença de caixa antes de fechar o turno.');
    expect(() => closingNotes(true, 'erro')).toThrow();
    expect(() => closingNotes(true, 'x'.repeat(501))).toThrow();
    expect(closingNotes(true, '  Troco dado a mais  ')).toBe('Troco dado a mais');
  });

  it('sem diferença, a observação é opcional', () => {
    expect(closingNotes(false, undefined)).toBeNull();
    expect(closingNotes(false, '  ')).toBeNull();
    expect(closingNotes(false, 'ok')).toBe('ok');
  });
});
