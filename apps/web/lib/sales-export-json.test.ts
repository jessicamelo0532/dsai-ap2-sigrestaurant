import { describe, expect, it } from 'vitest';
import { buildExportJson, exportJsonFilename, exportJsonString } from './sales-export-json';
import { reportForPeriod, type PaidSale } from './sales-report';

const line = (name: string, category: string, quantity: number, unitPriceCents: number) => ({
  key: `${name}|${category}`, name, category, quantity, unitPriceCents,
});
const sale = (paidAt: string, paymentMethod: PaidSale['paymentMethod'], lines: PaidSale['lines']): PaidSale => ({
  paidAt: new Date(paidAt), paymentMethod, lines,
});

const current = reportForPeriod([
  sale('2026-11-25T13:00:00Z', 'PIX', [line('Pizza', 'Pratos', 2, 3000)]),
], '2026-11-25', '2026-11-25');
const previous = reportForPeriod([
  sale('2026-11-24T13:00:00Z', 'CASH', [line('Pizza', 'Pratos', 1, 3000)]),
], '2026-11-24', '2026-11-24');

describe('buildExportJson', () => {
  it('inclui todos os núcleos esperados', () => {
    const json = buildExportJson(current, previous);
    expect(json).toMatchObject({
      from: '2026-11-25',
      to: '2026-11-25',
      revenue: '60.00',
      paidOrders: 1,
      averageTicket: '60.00',
      itemsSold: 2,
      hasPrevious: true,
    });
    expect(json.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(json.previous).toMatchObject({ from: '2026-11-24', revenue: '30.00' });
  });

  it('inclui categorias, pagamentos, dias, horas e rankings', () => {
    const json = buildExportJson(current, previous);
    expect(json.categories[0]).toMatchObject({ category: 'Pratos', quantity: 2 });
    expect(json.categories[0].revenue.replace(/\u00a0/g, ' ')).toBe('R$ 60,00');
    expect(json.payments.find((entry) => entry.method === 'PIX')).toMatchObject({ orders: 1 });
    expect(json.payments.find((entry) => entry.method === 'PIX')?.revenue.replace(/\u00a0/g, ' ')).toBe('R$ 60,00');
    expect(json.weekdays).toHaveLength(7);
    expect(json.hours).toHaveLength(24);
    expect(json.topByQuantity[0].name).toBe('Pizza');
    expect(json.topByRevenue[0].name).toBe('Pizza');
  });

  it('inclui insights e marca ausência de período anterior', () => {
    const json = buildExportJson(current, null);
    expect(json.hasPrevious).toBe(false);
    expect(json.previous).toBeNull();
    expect(json.insights.map((entry) => entry.title)).toContain('Receita contra o período anterior');
  });

  it('gera uma string JSON válida e nome de arquivo', () => {
    const text = exportJsonString(current, previous);
    expect(() => JSON.parse(text)).not.toThrow();
    expect(text).toContain('"categories"');
    expect(exportJsonFilename(current)).toBe('relatorio-vendas-2026-11-25-a-2026-11-25.json');
  });
});
