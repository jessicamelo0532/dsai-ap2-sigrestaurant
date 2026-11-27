import { describe, expect, it } from 'vitest';
import { reportForPeriod, type PaidSale } from './sales-report';
import {
  compareCategories, compareItems, comparePayments, compareTotals, compareWeekdays, comparisonCsv, salesInsights,
} from './sales-comparison';

const line = (key: string, name: string, category: string, quantity: number, unitPriceCents: number) => ({
  key, name, category, quantity, unitPriceCents,
});
const sale = (paidAt: string, paymentMethod: PaidSale['paymentMethod'], lines: PaidSale['lines']): PaidSale => ({
  paidAt: new Date(paidAt), paymentMethod, lines,
});

const current = reportForPeriod([
  sale('2026-11-25T13:00:00Z', 'PIX', [line('1|Pizza', 'Pizza', 'Pratos', 3, 3000)]),
  sale('2026-11-25T14:00:00Z', 'CASH', [line('2|Suco', 'Suco', 'Bebidas', 1, 1000)]),
], '2026-11-25', '2026-11-25');

const previous = reportForPeriod([
  sale('2026-11-24T13:00:00Z', 'PIX', [line('1|Pizza', 'Pizza', 'Pratos', 1, 3000)]),
], '2026-11-24', '2026-11-24');

// SPEC/2026-11-25-tela-de-relatorios-de-vendas.md (comparativo e CSV).
describe('comparativo de períodos', () => {
  it('compara os totais com variação e sem base', () => {
    const rows = compareTotals(current, previous);
    expect(rows.find((row) => row.key === 'revenue')).toMatchObject({
      current: '100.00', previous: '30.00', change: 233.3, format: 'money',
    });
    expect(rows.find((row) => row.key === 'paidOrders')).toMatchObject({ current: '2', previous: '1', change: 100 });
    expect(rows.find((row) => row.key === 'discounts')).toMatchObject({ current: '0.00', previous: '0.00', change: null });
  });

  it('une categorias dos dois períodos e ordena pela receita atual', () => {
    const rows = compareCategories(current, previous);
    expect(rows[0]).toMatchObject({ category: 'Pratos', currentRevenue: '90.00', previousRevenue: '30.00', change: 200 });
    expect(rows.find((row) => row.category === 'Bebidas')).toMatchObject({ currentRevenue: '10.00', previousRevenue: '0.00', change: null });
  });

  it('compara as quatro formas de pagamento', () => {
    const rows = comparePayments(current, previous);
    expect(rows).toHaveLength(4);
    expect(rows.find((row) => row.method === 'PIX')).toMatchObject({ currentRevenue: '90.00', previousRevenue: '30.00', change: 200 });
    expect(rows.find((row) => row.method === 'CASH')).toMatchObject({ currentRevenue: '10.00', previousRevenue: '0.00', change: null });
  });

  it('compara os sete dias da semana', () => {
    const rows = compareWeekdays(current, previous);
    expect(rows).toHaveLength(7);
    expect(rows.find((row) => row.weekday === 3)).toMatchObject({ currentRevenue: '100.00', previousRevenue: '0.00' });
    expect(rows.find((row) => row.weekday === 2)).toMatchObject({ currentRevenue: '0.00', previousRevenue: '30.00', change: -100 });
  });

  it('compara itens por receita e por quantidade', () => {
    const byRevenue = compareItems(current, previous, 'revenue');
    expect(byRevenue[0]).toMatchObject({ name: 'Pizza', currentRevenue: '90.00', previousRevenue: '30.00', revenueChange: 200 });
    const byQuantity = compareItems(current, previous, 'quantity');
    expect(byQuantity[0]).toMatchObject({ name: 'Pizza', currentQuantity: 3, previousQuantity: 1, quantityChange: 200 });
  });

  it('respeita o limite do comparativo de itens', () => {
    expect(compareItems(current, previous, 'revenue', 1)).toHaveLength(1);
  });
});

describe('insights', () => {
  it('resume crescimento, melhor horário, dia, categoria, pagamento e item', () => {
    const insights = salesInsights(current, previous);
    expect(insights.map((entry) => entry.title)).toEqual([
      'Receita contra o período anterior', 'Melhor horário', 'Melhor dia', 'Categoria líder', 'Forma de pagamento', 'Item de maior receita',
    ]);
    expect(insights[0].text).toContain('cresceu');
    expect(insights[1].text).toContain('10h');
    expect(insights[2].text).toContain('quarta-feira');
    expect(insights[3].text).toContain('Pratos');
    expect(insights[4].text).toContain('Pix');
    expect(insights[5].text).toContain('Pizza');
  });

  it('trata período anterior vazio', () => {
    const empty = reportForPeriod([], '2026-11-24', '2026-11-24');
    expect(salesInsights(current, empty)[0].text).toContain('Não há base anterior');
  });
});

describe('CSV do comparativo', () => {
  it('inclui as seções e valores com vírgula decimal', () => {
    const csv = comparisonCsv(current, previous);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('COMPARATIVO DE VENDAS');
    expect(csv).toContain('TOTAIS');
    expect(csv).toContain('CATEGORIAS');
    expect(csv).toContain('PAGAMENTOS');
    expect(csv).toContain('ITENS');
    expect(csv).toContain('Receita;100,00;30,00;233,3');
    expect(csv).toContain('Pratos;90,00;30,00;200,0');
  });
});
