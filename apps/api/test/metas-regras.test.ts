import { describe, expect, it } from 'vitest';
import { parseMonth } from '../src/closings/closing-rules';
import {
  attainment,
  compare,
  goalAttainment,
  monthWindow,
  parseGoal,
  previousMonthWindow,
  previousPeriod,
  summarize,
} from '../src/goals/goal-rules';

// Regras puras de metas e comparativo (SPEC/2026-11-16-metas-de-vendas.md).
const d = (iso: string) => new Date(`${iso}.000Z`);

describe('RF-01 e RN-02: meta', () => {
  it('aceita qualquer combinação com pelo menos uma meta', () => {
    expect(parseGoal({ revenue: 30000, orders: 600, averageTicket: '50.5' })).toEqual({
      revenueCents: 3_000_000, orders: 600, averageTicketCents: 5050,
    });
    expect(parseGoal({ orders: 1 })).toEqual({ revenueCents: null, orders: 1, averageTicketCents: null });
    expect(parseGoal({ revenue: 0.01, orders: null })).toEqual({ revenueCents: 1, orders: null, averageTicketCents: null });
  });

  it.each([
    [{ revenue: 0 }, 'Informe uma meta de receita válida.'],
    [{ revenue: -10 }, 'Informe uma meta de receita válida.'],
    [{ revenue: 10.001 }, 'Informe uma meta de receita válida.'],
    [{ revenue: 'muito' }, 'Informe uma meta de receita válida.'],
    [{ revenue: '' }, 'Informe uma meta de receita válida.'],
    [{ averageTicket: 0 }, 'Informe uma meta de ticket médio válida.'],
    [{ orders: 0 }, 'Informe uma meta de comandas válida.'],
    [{ orders: 2.5 }, 'Informe uma meta de comandas válida.'],
    [{ orders: '10' }, 'Informe uma meta de comandas válida.'],
    [{}, 'Informe pelo menos uma meta: receita, comandas ou ticket médio.'],
    [{ revenue: null, orders: null, averageTicket: null }, 'Informe pelo menos uma meta: receita, comandas ou ticket médio.'],
  ])('recusa %j', (input, message) => {
    expect(() => parseGoal(input)).toThrow(message);
  });
});

describe('RN-03: atingimento', () => {
  it('calcula com uma casa, passa de 100 e fica nulo sem meta', () => {
    expect(attainment(1500, 3000)).toBe(50);
    expect(attainment(1, 3)).toBe(33.3);
    expect(attainment(4500, 3000)).toBe(150);
    expect(attainment(0, 3000)).toBe(0);
    expect(attainment(1500, null)).toBeNull();
    expect(attainment(1500, 0)).toBeNull();
  });

  it('aplica a cada meta', () => {
    const actual = { revenueCents: 150_000, orders: 30, averageTicketCents: 5000 };
    expect(goalAttainment(actual, { revenueCents: 300_000, orders: null, averageTicketCents: 4000 })).toEqual({
      revenue: 50, orders: null, averageTicket: 125,
    });
    expect(goalAttainment(actual, null)).toEqual({ revenue: null, orders: null, averageTicket: null });
  });
});

describe('RN-05 e RN-06: janelas do mês (CA-02)', () => {
  const november = parseMonth('2026-11');

  it('vai do dia 1 até agora, sem passar do fim do mês; mês futuro fica vazio', () => {
    expect(monthWindow(november, d('2026-11-16T12:00:00'))).toEqual({ start: d('2026-11-01T00:00:00'), end: d('2026-11-16T12:00:00') });
    expect(monthWindow(november, d('2027-02-01T00:00:00')).end).toEqual(d('2026-12-01T00:00:00'));
    expect(monthWindow(november, d('2026-10-20T00:00:00'))).toEqual({ start: d('2026-11-01T00:00:00'), end: d('2026-11-01T00:00:00') });
  });

  it('compara com o mesmo tamanho do começo do mês anterior', () => {
    const current = monthWindow(november, d('2026-11-16T12:00:00'));
    expect(previousMonthWindow(november, current)).toEqual({ start: d('2026-10-01T00:00:00'), end: d('2026-10-16T12:00:00') });
  });

  it('não passa do fim de um mês anterior mais curto', () => {
    const march = parseMonth('2027-03');
    const current = monthWindow(march, d('2027-03-31T10:00:00'));
    expect(previousMonthWindow(march, current)).toEqual({ start: d('2027-02-01T00:00:00'), end: d('2027-03-01T00:00:00') });
  });
});

describe('RN-07: período anterior do comparativo (CA-02)', () => {
  it('tem o mesmo tamanho e termina onde o pedido começa', () => {
    expect(previousPeriod({ start: d('2026-11-09T00:00:00'), end: d('2026-11-16T00:00:00') })).toEqual({
      start: d('2026-11-02T00:00:00'), end: d('2026-11-09T00:00:00'),
    });
  });
});

describe('RN-08: resumo e variação', () => {
  it('soma receita, conta comandas e calcula o ticket médio', () => {
    expect(summarize([1000, 2000, 3001])).toEqual({ revenueCents: 6001, orders: 3, averageTicketCents: 2000 });
    expect(summarize([])).toEqual({ revenueCents: 0, orders: 0, averageTicketCents: 0 });
  });

  it('compara cada número; sem base, nulo', () => {
    expect(compare({ revenueCents: 15000, orders: 3, averageTicketCents: 5000 }, { revenueCents: 10000, orders: 4, averageTicketCents: 2500 })).toEqual({
      revenue: 50, orders: -25, averageTicket: 100,
    });
    expect(compare(summarize([100]), summarize([]))).toEqual({ revenue: null, orders: null, averageTicket: null });
  });
});
