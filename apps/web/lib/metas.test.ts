import { describe, expect, it } from 'vitest';
import {
  actualValueLabel, barWidth, currentMonth, GOAL_ERRORS, goalBody, goalForm, goalValueLabel, monthLabel, parseCount,
  parseReais, percentLabel, shiftMonth, validateComparePeriod, validateGoalForm, variationLabel, variationTone,
  windowLabel, yearOf,
} from './metas';

const money = (value: string) => `R$ ${value}`;

describe('valores digitados', () => {
  it.each([['50.000,00', 50000], ['50000.5', 50000.5], ['R$ 1.234,56', 1234.56], ['80', 80]])('reais %s', (raw, value) => {
    expect(parseReais(raw)).toBe(value);
  });

  it('reais vazio é null e inválido é NaN', () => {
    expect(parseReais(' ')).toBeNull();
    expect(parseReais('12,345')).toBeNaN();
    expect(parseReais('abc')).toBeNaN();
  });

  it('comandas inteiras', () => {
    expect(parseCount('1.200')).toBe(1200);
    expect(parseCount('')).toBeNull();
    expect(parseCount('1,5')).toBeNaN();
  });
});

describe('meta (RN-01, RF-04)', () => {
  it('aceita uma meta só', () => {
    expect(validateGoalForm({ revenue: '50.000,00', orders: '', averageTicket: '' })).toBeNull();
    expect(validateGoalForm({ revenue: '', orders: '600', averageTicket: '' })).toBeNull();
  });

  it('recusa tudo vazio', () => {
    expect(validateGoalForm({ revenue: '', orders: '', averageTicket: '' })).toBe(GOAL_ERRORS.empty);
  });

  it.each([
    [{ revenue: '0', orders: '', averageTicket: '' }, GOAL_ERRORS.revenue],
    [{ revenue: '', orders: '0', averageTicket: '' }, GOAL_ERRORS.orders],
    [{ revenue: '', orders: '2,5', averageTicket: '' }, GOAL_ERRORS.orders],
    [{ revenue: '', orders: '', averageTicket: '1,999' }, GOAL_ERRORS.averageTicket],
  ])('recusa %o', (form, message) => {
    expect(validateGoalForm(form)).toBe(message);
  });

  it('vazio vai como null', () => {
    expect(goalBody({ revenue: '50.000,00', orders: '', averageTicket: '' })).toEqual({ revenue: 50000, orders: null, averageTicket: null });
  });

  it('preenche o formulário a partir da meta', () => {
    expect(goalForm({ month: '2026-11', revenue: '50000.00', orders: 600, averageTicket: null })).toEqual({ revenue: '50.000,00', orders: '600', averageTicket: '' });
    expect(goalForm(null)).toEqual({ revenue: '', orders: '', averageTicket: '' });
  });
});

describe('meses (RN-02)', () => {
  it('mês atual no formato AAAA-MM', () => {
    expect(currentMonth(new Date(2026, 10, 17))).toBe('2026-11');
  });

  it('vira o ano nos dois sentidos', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-11', -1)).toBe('2026-10');
  });

  it('rótulo e ano', () => {
    expect(monthLabel('2026-11')).toBe('Novembro de 2026');
    expect(monthLabel('2026-03')).toBe('Março de 2026');
    expect(yearOf('2026-11')).toBe('2026');
  });
});

describe('percentuais e barra (RF-03, RNF-01)', () => {
  it('atingimento com uma casa', () => {
    expect(percentLabel(87.5)).toBe('87,5%');
    expect(percentLabel(112)).toBe('112,0%');
    expect(percentLabel(null)).toBe('—');
  });

  it('variação com sinal e sem base', () => {
    expect(variationLabel(12.3)).toBe('+12,3%');
    expect(variationLabel(-4)).toBe('−4,0%');
    expect(variationLabel(0)).toBe('0,0%');
    expect(variationLabel(null)).toBe('sem base');
    expect([variationTone(1), variationTone(-1), variationTone(0), variationTone(null)]).toEqual(['up', 'down', 'flat', 'flat']);
  });

  it('a barra fica entre 0 e 100', () => {
    expect(barWidth(112)).toBe(100);
    expect(barWidth(40.5)).toBe(40.5);
    expect(barWidth(null)).toBe(0);
    expect(barWidth(-3)).toBe(0);
  });
});

describe('rótulos de valores', () => {
  const goal = { month: '2026-11', revenue: '50000.00', orders: 600, averageTicket: null };
  const actual = { revenue: '43750.00', orders: 500, averageTicket: '87.50' };

  it('meta e realizado', () => {
    expect(goalValueLabel('revenue', goal, money)).toBe('R$ 50000.00');
    expect(goalValueLabel('orders', goal, money)).toBe('600');
    expect(goalValueLabel('averageTicket', goal, money)).toBe('sem meta');
    expect(goalValueLabel('revenue', null, money)).toBe('sem meta');
    expect(actualValueLabel('orders', actual, money)).toBe('500');
    expect(actualValueLabel('averageTicket', actual, money)).toBe('R$ 87.50');
  });
});

describe('comparativo (RN-03)', () => {
  it('exige as duas datas em ordem', () => {
    expect(validateComparePeriod({ from: '2026-11-01', to: '2026-11-07' })).toBeNull();
    expect(validateComparePeriod({ from: '', to: '2026-11-07' })).toMatch(/duas datas/);
    expect(validateComparePeriod({ from: '2026-11-08', to: '2026-11-07' })).toMatch(/anterior/);
  });

  it('mostra a janela com o fim exclusivo', () => {
    expect(windowLabel({ from: '2026-11-01T00:00:00.000Z', to: '2026-11-08T00:00:00.000Z' })).toBe('01/11 a 07/11');
    expect(windowLabel({ from: '2026-12-01T00:00:00.000Z', to: '2026-12-01T00:00:00.000Z' })).toBe('sem dias');
  });
});
