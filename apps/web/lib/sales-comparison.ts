// Comparativo entre o período atual e o anterior (SPEC/2026-11-25-tela-de-relatorios-de-vendas.md).
import {
  PAYMENT_LABELS, PAYMENT_METHODS, centsOf, changePercent, csvLine, csvMoney, formatShare, type PaymentMethod,
  type SalesReport,
} from './sales-report';

export type MetricFormat = 'money' | 'count';
export type TotalComparison = {
  key: string;
  label: string;
  current: string;
  previous: string;
  change: number | null;
  format: MetricFormat;
};

export type CategoryComparison = {
  category: string;
  currentRevenue: string;
  previousRevenue: string;
  currentQuantity: number;
  previousQuantity: number;
  change: number | null;
};

export type PaymentComparison = {
  method: PaymentMethod;
  label: string;
  currentRevenue: string;
  previousRevenue: string;
  currentOrders: number;
  previousOrders: number;
  change: number | null;
};

export type WeekdayComparison = {
  weekday: number;
  label: string;
  currentRevenue: string;
  previousRevenue: string;
  currentOrders: number;
  previousOrders: number;
  change: number | null;
};

export type ItemComparison = {
  name: string;
  category: string;
  currentQuantity: number;
  previousQuantity: number;
  currentRevenue: string;
  previousRevenue: string;
  quantityChange: number | null;
  revenueChange: number | null;
};

export type Insight = { title: string; text: string };

export function compareTotals(current: SalesReport, previous: SalesReport): TotalComparison[] {
  const row = (key: string, label: string, now: string, before: string, format: MetricFormat): TotalComparison => ({
    key, label, current: now, previous: before, change: changePercent(now, before), format,
  });
  return [
    row('revenue', 'Receita', current.revenue, previous.revenue, 'money'),
    row('netRevenue', 'Receita líquida', current.netRevenue, previous.netRevenue, 'money'),
    row('paidOrders', 'Contas pagas', String(current.paidOrders), String(previous.paidOrders), 'count'),
    row('averageTicket', 'Ticket médio', current.averageTicket, previous.averageTicket, 'money'),
    row('itemsSold', 'Itens vendidos', String(current.itemsSold), String(previous.itemsSold), 'count'),
    row('discounts', 'Descontos', current.discounts, previous.discounts, 'money'),
    row('deliveryFees', 'Taxas de entrega', current.deliveryFees, previous.deliveryFees, 'money'),
  ];
}

export function compareCategories(current: SalesReport, previous: SalesReport): CategoryComparison[] {
  const names = new Set([...current.byCategory.map((entry) => entry.category), ...previous.byCategory.map((entry) => entry.category)]);
  return [...names].map((category) => {
    const now = current.byCategory.find((entry) => entry.category === category);
    const before = previous.byCategory.find((entry) => entry.category === category);
    return {
      category,
      currentRevenue: now?.revenue ?? '0.00',
      previousRevenue: before?.revenue ?? '0.00',
      currentQuantity: now?.quantity ?? 0,
      previousQuantity: before?.quantity ?? 0,
      change: changePercent(now?.revenue ?? '0', before?.revenue ?? '0'),
    };
  }).sort((a, b) => centsOf(b.currentRevenue) - centsOf(a.currentRevenue) || a.category.localeCompare(b.category, 'pt-BR'));
}

export function comparePayments(current: SalesReport, previous: SalesReport): PaymentComparison[] {
  return PAYMENT_METHODS.map((method) => {
    const now = current.byPayment.find((entry) => entry.method === method);
    const before = previous.byPayment.find((entry) => entry.method === method);
    return {
      method,
      label: PAYMENT_LABELS[method],
      currentRevenue: now?.revenue ?? '0.00',
      previousRevenue: before?.revenue ?? '0.00',
      currentOrders: now?.orders ?? 0,
      previousOrders: before?.orders ?? 0,
      change: changePercent(now?.revenue ?? '0', before?.revenue ?? '0'),
    };
  });
}

export function compareWeekdays(current: SalesReport, previous: SalesReport): WeekdayComparison[] {
  return current.byWeekday.map((day) => {
    const before = previous.byWeekday.find((entry) => entry.weekday === day.weekday);
    return {
      weekday: day.weekday,
      label: day.label,
      currentRevenue: day.revenue,
      previousRevenue: before?.revenue ?? '0.00',
      currentOrders: day.orders,
      previousOrders: before?.orders ?? 0,
      change: changePercent(day.revenue, before?.revenue ?? '0'),
    };
  });
}

export function compareItems(
  current: SalesReport,
  previous: SalesReport,
  rank: 'quantity' | 'revenue' = 'revenue',
  limit = 10,
): ItemComparison[] {
  const keyOf = (item: { name: string; category: string }) => `${item.name}|${item.category}`;
  const items = new Map<string, ItemComparison>();
  const add = (report: SalesReport, side: 'current' | 'previous') => {
    const source = rank === 'revenue' ? report.topByRevenue : report.topByQuantity;
    for (const item of source) {
      const key = keyOf(item);
      const row = items.get(key) ?? {
        name: item.name,
        category: item.category,
        currentQuantity: 0,
        previousQuantity: 0,
        currentRevenue: '0.00',
        previousRevenue: '0.00',
        quantityChange: null,
        revenueChange: null,
      };
      if (side === 'current') {
        row.currentQuantity = item.quantity;
        row.currentRevenue = item.revenue;
      } else {
        row.previousQuantity = item.quantity;
        row.previousRevenue = item.revenue;
      }
      items.set(key, row);
    }
  };
  add(current, 'current');
  add(previous, 'previous');
  return [...items.values()].map((row) => ({
    ...row,
    quantityChange: changePercent(row.currentQuantity, row.previousQuantity),
    revenueChange: changePercent(row.currentRevenue, row.previousRevenue),
  })).sort((a, b) => {
    const value = rank === 'revenue'
      ? centsOf(b.currentRevenue) - centsOf(a.currentRevenue)
      : b.currentQuantity - a.currentQuantity;
    return value || a.name.localeCompare(b.name, 'pt-BR');
  }).slice(0, limit);
}

export function salesInsights(current: SalesReport, previous: SalesReport): Insight[] {
  const insights: Insight[] = [];
  const growth = changePercent(current.revenue, previous.revenue);
  insights.push({
    title: 'Receita contra o período anterior',
    text: growth === null
      ? `Não há base anterior para comparar; a receita atual é ${current.revenue}.`
      : `A receita ${growth >= 0 ? 'cresceu' : 'caiu'} ${formatShare(Math.abs(growth))} na comparação com o período anterior.`,
  });

  const bestHour = [...current.byHour].sort((a, b) => centsOf(b.revenue) - centsOf(a.revenue))[0];
  if (bestHour && centsOf(bestHour.revenue) > 0) {
    insights.push({
      title: 'Melhor horário',
      text: `A faixa das ${bestHour.hour}h concentra a maior receita do período, com ${bestHour.orders} contas.`,
    });
  }

  const bestDay = [...current.byWeekday].sort((a, b) => centsOf(b.revenue) - centsOf(a.revenue))[0];
  if (bestDay && centsOf(bestDay.revenue) > 0) {
    insights.push({
      title: 'Melhor dia',
      text: `${bestDay.label} é o dia mais forte, com ${bestDay.orders} contas e receita de ${bestDay.revenue}.`,
    });
  }

  const topCategory = current.byCategory[0];
  if (topCategory) {
    insights.push({
      title: 'Categoria líder',
      text: `${topCategory.category} responde por ${formatShare(topCategory.share)} da receita, com ${topCategory.quantity} itens vendidos.`,
    });
  }

  const topPayment = [...current.byPayment].sort((a, b) => centsOf(b.revenue) - centsOf(a.revenue))[0];
  if (topPayment && centsOf(topPayment.revenue) > 0) {
    insights.push({
      title: 'Forma de pagamento',
      text: `${PAYMENT_LABELS[topPayment.method]} lidera com ${formatShare(topPayment.share)} da receita.`,
    });
  }

  const topItem = current.topByRevenue[0];
  if (topItem) {
    insights.push({
      title: 'Item de maior receita',
      text: `${topItem.name} gerou ${topItem.revenue} e representa ${formatShare(topItem.share)} da receita.`,
    });
  }

  return insights;
}

export function comparisonCsv(current: SalesReport, previous: SalesReport): string {
  const rows: string[] = [];
  rows.push(csvLine(['COMPARATIVO DE VENDAS']));
  rows.push(csvLine(['Atual', current.from, current.to]));
  rows.push(csvLine(['Anterior', previous.from, previous.to]));
  rows.push('');
  rows.push(csvLine(['TOTAIS']));
  rows.push(csvLine(['Indicador', 'Atual', 'Anterior', 'Variação (%)']));
  for (const row of compareTotals(current, previous)) {
    rows.push(csvLine([
      row.label,
      row.format === 'money' ? csvMoney(row.current) : row.current,
      row.format === 'money' ? csvMoney(row.previous) : row.previous,
      row.change === null ? 'sem base' : row.change.toFixed(1).replace('.', ','),
    ]));
  }
  rows.push('');
  rows.push(csvLine(['CATEGORIAS']));
  rows.push(csvLine(['Categoria', 'Receita atual', 'Receita anterior', 'Variação (%)']));
  for (const row of compareCategories(current, previous)) {
    rows.push(csvLine([
      row.category, csvMoney(row.currentRevenue), csvMoney(row.previousRevenue),
      row.change === null ? 'sem base' : row.change.toFixed(1).replace('.', ','),
    ]));
  }
  rows.push('');
  rows.push(csvLine(['PAGAMENTOS']));
  rows.push(csvLine(['Forma', 'Receita atual', 'Receita anterior', 'Variação (%)']));
  for (const row of comparePayments(current, previous)) {
    rows.push(csvLine([
      row.label, csvMoney(row.currentRevenue), csvMoney(row.previousRevenue),
      row.change === null ? 'sem base' : row.change.toFixed(1).replace('.', ','),
    ]));
  }
  rows.push('');
  rows.push(csvLine(['ITENS']));
  rows.push(csvLine(['Item', 'Categoria', 'Receita atual', 'Receita anterior', 'Quantidade atual', 'Quantidade anterior']));
  for (const row of compareItems(current, previous)) {
    rows.push(csvLine([
      row.name, row.category, csvMoney(row.currentRevenue), csvMoney(row.previousRevenue), row.currentQuantity, row.previousQuantity,
    ]));
  }
  return `\uFEFF${rows.join('\n')}\n`;
}
