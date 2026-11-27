import { describe, expect, it } from 'vitest';
import type { Order } from './types';
import {
  DEFAULT_LIMIT, REMOVED_CATEGORY, averageTicketCents, buildSalesReport, categoryHourIntensity, centsOf,
  changePercent, csvMoney, emptyReport, formatChange, formatShare, hasSales, maxCategoryHourCents, paidSalesFromOrders,
  parseLimit, previousPeriod, rankByQuantity, rankByRevenue, reportFilename, reportForPeriod, salesReportCsv,
  topItems, validatePeriod, type PaidSale, type SaleLine,
} from './sales-report';

const line = (key: string, name: string, category: string, quantity: number, unitPriceCents: number): SaleLine => ({
  key, name, category, quantity, unitPriceCents,
});

const sale = (paidAt: string, paymentMethod: PaidSale['paymentMethod'], lines: SaleLine[], extra: Partial<PaidSale> = {}): PaidSale => ({
  paidAt: new Date(paidAt), paymentMethod, lines, ...extra,
});

const pizza = line('1|Pizza', 'Pizza', 'Pratos', 2, 3000);
const juice = line('2|Suco', 'Suco', 'Bebidas', 1, 900);
const sale1 = sale('2026-11-25T13:00:00.000Z', 'PIX', [pizza, juice], { discountCents: 500, deliveryFeeCents: 200 });
const sale2 = sale('2026-11-25T02:30:00.000Z', 'CASH', [line('1|Pizza', 'Pizza', 'Pratos', 1, 3000)]);

// SPEC/2026-11-25-tela-de-relatorios-de-vendas.md (RN-01 a RN-11).
describe('período e limite', () => {
  it('valida o período com as mesmas mensagens da API', () => {
    expect(validatePeriod('2026-11-01', '2026-11-30')).toBeNull();
    expect(validatePeriod('2026-11-31', '2026-12-01')).toBe('Informe datas válidas no formato AAAA-MM-DD.');
    expect(validatePeriod('2026-11-30', '2026-11-01')).toBe('A data inicial deve ser anterior ou igual à data final.');
    expect(validatePeriod('01/11/2026', '2026-11-30')).toBe('Informe datas válidas no formato AAAA-MM-DD.');
  });

  it('calcula o período anterior com a mesma quantidade de dias', () => {
    expect(previousPeriod('2026-11-25', '2026-11-25')).toEqual({ from: '2026-11-24', to: '2026-11-24' });
    expect(previousPeriod('2026-11-01', '2026-11-03')).toEqual({ from: '2026-10-29', to: '2026-10-31' });
    expect(previousPeriod('2026-01-01', '2026-01-02')).toEqual({ from: '2025-12-30', to: '2025-12-31' });
    expect(previousPeriod('2024-03-01', '2024-03-01')).toEqual({ from: '2024-02-29', to: '2024-02-29' });
  });

  it('valida o limite de 1 a 50', () => {
    expect(parseLimit(undefined)).toBe(DEFAULT_LIMIT);
    expect(parseLimit('20')).toBe(20);
    expect(() => parseLimit('0')).toThrow('Informe um limite de 1 a 50 itens.');
    expect(() => parseLimit('51')).toThrow('Informe um limite de 1 a 50 itens.');
    expect(() => parseLimit('2.5')).toThrow('Informe um limite de 1 a 50 itens.');
  });
});

describe('agregação', () => {
  const report = reportForPeriod([sale1, sale2], '2026-11-24', '2026-11-25');

  it('soma receita, descontos, taxas, líquido, itens e ticket médio', () => {
    expect(report.paidOrders).toBe(2);
    expect(report.revenue).toBe('99.00');
    expect(report.discounts).toBe('5.00');
    expect(report.deliveryFees).toBe('2.00');
    expect(report.netRevenue).toBe('96.00');
    expect(report.itemsSold).toBe(4);
    expect(report.averageTicket).toBe('49.50');
  });

  it('ranqueia por quantidade e por receita com participação', () => {
    expect(report.topByQuantity.map((item) => [item.name, item.quantity, item.revenue, item.share])).toEqual([
      ['Pizza', 3, '90.00', 90.9],
      ['Suco', 1, '9.00', 9.1],
    ]);
    expect(report.topByRevenue[0].name).toBe('Pizza');
    expect(topItems(report, 'quantity')).toEqual(report.topByQuantity);
    expect(topItems(report, 'revenue')).toEqual(report.topByRevenue);
  });

  it('distribui por categoria, hora, dia e pagamento sem perder receita', () => {
    expect(report.byCategory.map((category) => [category.category, category.quantity, category.revenue])).toEqual([
      ['Pratos', 3, '90.00'],
      ['Bebidas', 1, '9.00'],
    ]);
    expect(report.byHour).toHaveLength(24);
    expect(report.byHour[10]).toMatchObject({ orders: 1, revenue: '69.00' });
    expect(report.byHour[23]).toMatchObject({ orders: 1, revenue: '30.00' });
    expect(report.byWeekday[3]).toMatchObject({ label: 'quarta-feira', orders: 1, revenue: '69.00' });
    expect(report.byWeekday[2]).toMatchObject({ label: 'terça-feira', orders: 1, revenue: '30.00' });
    expect(report.byPayment.find((entry) => entry.method === 'PIX')).toMatchObject({ orders: 1, revenue: '69.00', share: 69.7 });
    expect(report.byPayment.find((entry) => entry.method === 'CASH')).toMatchObject({ orders: 1, revenue: '30.00', share: 30.3 });

    const totalCents = centsOf(report.revenue);
    expect(report.byCategory.reduce((sum, category) => sum + centsOf(category.revenue), 0)).toBe(totalCents);
    expect(report.byHour.reduce((sum, hour) => sum + centsOf(hour.revenue), 0)).toBe(totalCents);
    expect(report.byWeekday.reduce((sum, day) => sum + centsOf(day.revenue), 0)).toBe(totalCents);
    expect(report.byPayment.reduce((sum, payment) => sum + centsOf(payment.revenue), 0)).toBe(totalCents);
  });

  it('cruza categoria e hora e calcula a intensidade do heatmap', () => {
    const pratos = report.categoryByHour.find((row) => row.category === 'Pratos')!;
    expect(pratos.hours[10]).toBe('60.00');
    expect(pratos.hours[23]).toBe('30.00');
    expect(maxCategoryHourCents(report)).toBe(6000);
    expect(categoryHourIntensity(report, '60.00')).toBe(100);
    expect(categoryHourIntensity(report, '30.00')).toBe(50);
    expect(categoryHourIntensity(report, '0.00')).toBe(0);
  });

  it('respeita o limite do ranking', () => {
    const limited = buildSalesReport([sale1, sale2], 1);
    expect(limited.topByQuantity).toHaveLength(1);
    expect(limited.topByRevenue).toHaveLength(1);
  });

  it('trata item removido do cardápio e período vazio', () => {
    const removed = buildSalesReport([sale('2026-11-25T13:00:00Z', 'PIX', [line('9|Fora', 'Fora', REMOVED_CATEGORY, 1, 1000)])]);
    expect(removed.byCategory[0]).toMatchObject({ category: REMOVED_CATEGORY, revenue: '10.00' });
    expect(emptyReport('2026-11-01', '2026-11-30').paidOrders).toBe(0);
    expect(hasSales(emptyReport('2026-11-01', '2026-11-30'))).toBe(false);
  });
});

describe('comparativo', () => {
  it('calcula variação e trata base zero', () => {
    expect(changePercent('120.00', '100.00')).toBe(20);
    expect(changePercent('80.00', '100.00')).toBe(-20);
    expect(changePercent('100.00', '0')).toBeNull();
    expect(formatChange('120.00', '100.00')).toBe('+20,0%');
    expect(formatChange('80.00', '100.00')).toBe('-20,0%');
    expect(formatChange('100.00', '0')).toBe('sem base');
    expect(formatShare(90.94)).toBe('90,9%');
  });

  it('calcula ticket médio em centavos', () => {
    expect(averageTicketCents(1000, 3)).toBe(333);
    expect(averageTicketCents(0, 0)).toBe(0);
  });
});

describe('CSV', () => {
  it('inclui BOM, seções e vírgula decimal', () => {
    const csv = salesReportCsv(reportForPeriod([sale1, sale2], '2026-11-24', '2026-11-25'));
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('RELATÓRIO DE VENDAS');
    expect(csv).toContain('ITENS POR QUANTIDADE');
    expect(csv).toContain('ITENS POR RECEITA');
    expect(csv).toContain('CATEGORIAS');
    expect(csv).toContain('HORAS');
    expect(csv).toContain('DIAS DA SEMANA');
    expect(csv).toContain('FORMAS DE PAGAMENTO');
    expect(csv).toContain('CATEGORIA X HORA');
    expect(csv).toContain('Receita;99,00');
    expect(csv).toContain('Pizza;Pratos;3;90,00;90,9');
    expect(csv).toContain('Pix;1;69,00;69,7');
  });

  it('escapa ponto e vírgula, aspas e quebra de linha', () => {
    const special = buildSalesReport([
      sale('2026-11-25T13:00:00Z', 'PIX', [line('7|Prato', 'Prato "especial"', 'Padaria; café', 1, 1000)]),
    ]);
    const csv = salesReportCsv(reportForPeriod([], '2026-11-24', '2026-11-25'));
    expect(csv).toContain('CATEGORIA X HORA');
    const reportCsv = salesReportCsv({ ...reportForPeriod([], '2026-11-24', '2026-11-25'), ...special, from: '2026-11-24', to: '2026-11-25' });
    expect(reportCsv).toContain('"Prato ""especial"""');
    expect(reportCsv).toContain('"Padaria; café"');
    expect(csvMoney('1234.50')).toBe('1234,50');
    expect(reportFilename('2026-11-01', '2026-11-30')).toBe('relatorio-vendas-2026-11-01-a-2026-11-30.csv');
  });
});

describe('conversão do modo navegador', () => {
  const order = (overrides: Partial<Order>): Order => ({
    id: 1, tableNumber: 1, status: 'PAID', openedAt: '2026-11-25T12:00:00.000Z',
    paidAt: '2026-11-25T13:00:00.000Z', paymentMethod: 'PIX', discount: '1.50',
    items: [{ id: 1, menuItemId: 7, nameSnapshot: 'Pizza', unitPrice: '30.00', quantity: 2 }],
    ...overrides,
  });

  it('converte comandas pagas, desconto e categoria atual', () => {
    const sales = paidSalesFromOrders([order({}), order({ id: 2, status: 'OPEN', paidAt: null, paymentMethod: null })], (id) => id === 7 ? 'Pratos' : REMOVED_CATEGORY);
    expect(sales).toHaveLength(1);
    expect(sales[0].discountCents).toBe(150);
    expect(sales[0].lines[0]).toMatchObject({ name: 'Pizza', category: 'Pratos', quantity: 2, unitPriceCents: 3000 });
  });

  it('mantém item removido com a categoria de fallback', () => {
    const sales = paidSalesFromOrders([order({ items: [{ id: 1, menuItemId: null, nameSnapshot: 'Antigo', unitPrice: '10.00', quantity: 1 }] })], () => REMOVED_CATEGORY);
    expect(sales[0].lines[0].category).toBe(REMOVED_CATEGORY);
  });

  it('ordena rankings com desempate estável', () => {
    const items = [
      { name: 'B', quantity: 2, revenueCents: 100, share: 0 },
      { name: 'A', quantity: 2, revenueCents: 100, share: 0 },
      { name: 'C', quantity: 3, revenueCents: 50, share: 0 },
    ];
    expect(rankByQuantity(items).map((item) => item.name)).toEqual(['C', 'A', 'B']);
    expect(rankByRevenue(items).map((item) => item.name)).toEqual(['A', 'B', 'C']);
  });
});
