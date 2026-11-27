import { describe, expect, it } from 'vitest';
import { dateRange } from '../src/common/period';
import {
  buildSalesReport,
  localSlot,
  PaidSale,
  parseLimit,
  rankByQuantity,
  rankByRevenue,
  REMOVED_CATEGORY,
  SaleLine,
  share,
} from '../src/sales-reports/sales-rules';

const line = (key: string, name: string, category: string, quantity: number, unitPriceCents: number): SaleLine => ({
  key, name, category, quantity, unitPriceCents,
});

// Três contas pagas: duas no almoço de segunda (Belém) e uma no jantar de sexta.
const sales: PaidSale[] = [
  {
    paidAt: new Date('2026-11-16T15:30:00.000Z'), // segunda, 12h30 em Belém
    paymentMethod: 'PIX',
    waiterName: 'Ana',
    lines: [line('1|Tacacá', 'Tacacá', 'Pratos', 2, 1800), line('2|Suco', 'Suco', 'Bebidas', 2, 900)],
  },
  {
    paidAt: new Date('2026-11-16T15:59:00.000Z'), // segunda, 12h59 em Belém
    paymentMethod: 'CASH',
    lines: [line('1|Tacacá', 'Tacacá', 'Pratos', 1, 1800), line('x|Pato antigo', 'Pato antigo', REMOVED_CATEGORY, 1, 5000)],
  },
  {
    paidAt: new Date('2026-11-21T02:30:00.000Z'), // sexta 20/11, 23h30 em Belém
    paymentMethod: 'PIX',
    waiterName: 'Ana',
    lines: [line('2|Suco', 'Suco', 'Bebidas', 5, 900)],
  },
];

describe('período compartilhado com o relatório financeiro', () => {
  it('data final inclusiva e mensagens de sempre', () => {
    const [start, end] = dateRange('2026-11-16', '2026-11-20');
    expect(start.toISOString()).toBe('2026-11-16T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-21T00:00:00.000Z');
    expect(() => dateRange('2026-11-20', '2026-11-16')).toThrow('A data inicial deve ser anterior ou igual à data final.');
    expect(() => dateRange('16/11/2026', '2026-11-20')).toThrow('Informe datas válidas no formato AAAA-MM-DD.');
    expect(() => dateRange('2026-02-30', '2026-03-01')).toThrow('Informe datas válidas no formato AAAA-MM-DD.');
  });
});

describe('RN-06: limite do ranking', () => {
  it('padrão 10, de 1 a 50', () => {
    expect(parseLimit(undefined)).toBe(10);
    expect(parseLimit('')).toBe(10);
    expect(parseLimit('1')).toBe(1);
    expect(parseLimit('50')).toBe(50);
  });

  it.each(['0', '51', '2.5', 'dez', '-1'])('recusa "%s"', (value) => {
    expect(() => parseLimit(value)).toThrow('Informe um limite de 1 a 50 itens.');
  });
});

describe('RN-05: horário de Belém', () => {
  it('23h30 UTC vira 20h30 do mesmo dia; 02h30 UTC vira 23h30 do dia anterior', () => {
    expect(localSlot(new Date('2026-11-16T23:30:00.000Z'))).toEqual({ hour: 20, weekday: 1 });
    expect(localSlot(new Date('2026-11-21T02:30:00.000Z'))).toEqual({ hour: 23, weekday: 5 });
    expect(localSlot(new Date('2026-11-16T03:00:00.000Z'))).toEqual({ hour: 0, weekday: 1 });
  });
});

describe('RNF-02: participação', () => {
  it('uma casa decimal e zero sem receita', () => {
    expect(share(1, 3)).toBe(33.3);
    expect(share(2, 3)).toBe(66.7);
    expect(share(5, 0)).toBe(0);
  });
});

describe('RF-02 a RF-07: relatório', () => {
  const report = buildSalesReport(sales);

  it('totais: contas, receita, itens e ticket médio', () => {
    expect(report).toMatchObject({ paidOrders: 3, revenueCents: 3600 + 1800 + 1800 + 5000 + 4500, itemsSold: 11 });
    expect(report.averageTicketCents).toBe(Math.round(16700 / 3));
  });

  it('CA-02: ranking por quantidade soma as quantidades vendidas, com participação na receita', () => {
    expect(report.topByQuantity).toEqual([
      { name: 'Suco', category: 'Bebidas', quantity: 7, revenueCents: 6300, share: 37.7 },
      { name: 'Tacacá', category: 'Pratos', quantity: 3, revenueCents: 5400, share: 32.3 },
      { name: 'Pato antigo', category: REMOVED_CATEGORY, quantity: 1, revenueCents: 5000, share: 29.9 },
    ]);
    expect(report.topByQuantity.reduce((total, item) => total + item.quantity, 0)).toBe(report.itemsSold);
  });

  it('ranking por receita e limite', () => {
    expect(report.topByRevenue.map((item) => item.name)).toEqual(['Suco', 'Tacacá', 'Pato antigo']);
    expect(buildSalesReport(sales, 1).topByQuantity.map((item) => item.name)).toEqual(['Suco']);
  });

  it('CA-03: soma por categoria igual à receita total, da maior para a menor', () => {
    expect(report.byCategory.map((item) => [item.category, item.revenueCents, item.share])).toEqual([
      ['Bebidas', 6300, 37.7],
      ['Pratos', 5400, 32.3],
      [REMOVED_CATEGORY, 5000, 29.9],
    ]);
    expect(report.byCategory.reduce((total, item) => total + item.revenueCents, 0)).toBe(report.revenueCents);
  });

  it('CA-03: faixas horárias cobrem todas as contas pagas e toda a receita', () => {
    expect(report.byHour).toHaveLength(24);
    expect(report.byHour[12]).toEqual({ hour: 12, orders: 2, revenueCents: 12200 });
    expect(report.byHour[23]).toEqual({ hour: 23, orders: 1, revenueCents: 4500 });
    expect(report.byHour.reduce((total, slot) => total + slot.orders, 0)).toBe(3);
    expect(report.byHour.reduce((total, slot) => total + slot.revenueCents, 0)).toBe(report.revenueCents);
  });

  it('dias da semana em português, somando a receita', () => {
    expect(report.byWeekday[1]).toEqual({ weekday: 1, label: 'segunda-feira', orders: 2, revenueCents: 12200 });
    expect(report.byWeekday[5]).toMatchObject({ label: 'sexta-feira', orders: 1, revenueCents: 4500 });
    expect(report.byWeekday.reduce((total, day) => total + day.revenueCents, 0)).toBe(report.revenueCents);
  });

  it('evolução diária agrupa por data local de Belém', () => {
    expect(report.byDay).toEqual([
      { date: '2026-11-16', weekday: 1, label: 'segunda-feira', orders: 2, revenueCents: 12200 },
      { date: '2026-11-20', weekday: 5, label: 'sexta-feira', orders: 1, revenueCents: 4500 },
    ]);
  });

  it('desempenho por garçom soma contas, receita, ticket e participação', () => {
    expect(report.byWaiter).toEqual([
      { waiterName: 'Ana', orders: 2, revenueCents: 9900, averageTicketCents: 4950, share: 59.3 },
      { waiterName: 'Sem garçom', orders: 1, revenueCents: 6800, averageTicketCents: 6800, share: 40.7 },
    ]);
  });

  it('formas de pagamento em ordem fixa, com contas, receita e participação', () => {
    expect(report.byPayment).toEqual([
      { method: 'CASH', orders: 1, revenueCents: 6800, share: 40.7 },
      { method: 'CREDIT', orders: 0, revenueCents: 0, share: 0 },
      { method: 'DEBIT', orders: 0, revenueCents: 0, share: 0 },
      { method: 'PIX', orders: 2, revenueCents: 9900, share: 59.3 },
    ]);
  });

  it('cruzamento categoria × hora', () => {
    const drinks = report.categoryByHour.find((item) => item.category === 'Bebidas')!;
    expect(drinks.hours).toHaveLength(24);
    expect(drinks.hours[12]).toBe(1800);
    expect(drinks.hours[23]).toBe(4500);
    expect(drinks.hours.reduce((total, cents) => total + cents, 0)).toBe(6300);
  });

  it('período sem vendas: tudo zerado', () => {
    const empty = buildSalesReport([]);
    expect(empty).toMatchObject({ paidOrders: 0, revenueCents: 0, itemsSold: 0, averageTicketCents: 0, topByQuantity: [], byCategory: [] });
    expect(empty.byPayment.every((payment) => payment.share === 0)).toBe(true);
  });
});

describe('RF-03: desempates do ranking', () => {
  const stat = (name: string, quantity: number, revenueCents: number) => ({ name, category: 'X', quantity, revenueCents, share: 0 });

  it('por quantidade: empate decide pela receita e depois pelo nome', () => {
    const ranked = rankByQuantity([stat('Bolo', 2, 100), stat('Açaí', 2, 100), stat('Café', 2, 300), stat('Chá', 5, 50)]);
    expect(ranked.map((item) => item.name)).toEqual(['Chá', 'Café', 'Açaí', 'Bolo']);
  });

  it('por receita: empate decide pela quantidade e depois pelo nome', () => {
    const ranked = rankByRevenue([stat('Bolo', 1, 500), stat('Açaí', 1, 500), stat('Café', 3, 500), stat('Chá', 1, 900)]);
    expect(ranked.map((item) => item.name)).toEqual(['Chá', 'Café', 'Açaí', 'Bolo']);
  });
});
