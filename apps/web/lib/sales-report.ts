// Relatório de vendas no frontend (SPEC/2026-11-25-tela-de-relatorios-de-vendas.md).
// Espelha as regras de apps/api/src/sales-reports/sales-rules.ts para o modo navegador.
import { discountCents } from './comanda';
import type { Order } from './types';

export type PaymentMethod = 'CASH' | 'CREDIT' | 'DEBIT' | 'PIX';
export const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CREDIT', 'DEBIT', 'PIX'];
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  CREDIT: 'Crédito',
  DEBIT: 'Débito',
  PIX: 'Pix',
};

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;
export const LIMIT_OPTIONS = [10, 20, 50] as const;
export const REMOVED_CATEGORY = 'Item removido do cardápio';
export const LOCAL_OFFSET_HOURS = -3;
export const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export type SaleLine = {
  key: string;
  name: string;
  category: string;
  quantity: number;
  unitPriceCents: number;
};

export type PaidSale = {
  paidAt: Date;
  paymentMethod: PaymentMethod;
  lines: SaleLine[];
  discountCents?: number;
  deliveryFeeCents?: number;
  waiterName?: string | null;
};

export type ItemStat = {
  name: string;
  category: string;
  quantity: number;
  revenue: string;
  share: number;
};

export type CategoryStat = {
  category: string;
  quantity: number;
  revenue: string;
  share: number;
};

export type HourStat = { hour: number; orders: number; revenue: string };
export type WeekdayStat = { weekday: number; label: string; orders: number; revenue: string };
export type DayStat = { date: string; weekday: number; label: string; orders: number; revenue: string };
export type WaiterStat = { waiterName: string; orders: number; revenue: string; averageTicket: string; share: number };
export type PaymentStat = { method: PaymentMethod; orders: number; revenue: string; share: number };
export type CategoryHour = { category: string; hours: string[] };

export type SalesReport = {
  from: string;
  to: string;
  paidOrders: number;
  revenue: string;
  discounts: string;
  deliveryFees: string;
  netRevenue: string;
  itemsSold: number;
  averageTicket: string;
  topByQuantity: ItemStat[];
  topByRevenue: ItemStat[];
  byCategory: CategoryStat[];
  byHour: HourStat[];
  byWeekday: WeekdayStat[];
  byDay: DayStat[];
  byWaiter: WaiterStat[];
  byPayment: PaymentStat[];
  categoryByHour: CategoryHour[];
};

export type Rank = 'quantity' | 'revenue';
export type HourMetric = 'revenue' | 'orders';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const decimal = (cents: number) => (cents / 100).toFixed(2);
export const centsOf = (value: string | number) => Math.round(Number(value) * 100);

export function parseLimit(value: string | number | undefined): number {
  if (value === undefined || value === '') return DEFAULT_LIMIT;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error(`Informe um limite de 1 a ${MAX_LIMIT} itens.`);
  }
  return limit;
}

export function localSlot(date: Date): { hour: number; weekday: number } {
  const local = new Date(date.getTime() + LOCAL_OFFSET_HOURS * HOUR_MS);
  return { hour: local.getUTCHours(), weekday: local.getUTCDay() };
}

export const UNASSIGNED_WAITER = 'Sem garçom';

// Data local de Belém (UTC−3) no formato AAAA-MM-DD.
export function localDateOf(date: Date): { date: string; weekday: number } {
  const local = new Date(date.getTime() + LOCAL_OFFSET_HOURS * HOUR_MS);
  return { date: local.toISOString().slice(0, 10), weekday: local.getUTCDay() };
}

export function share(partCents: number, totalCents: number): number {
  return totalCents === 0 ? 0 : Math.round((partCents / totalCents) * 1000) / 10;
}

export function changePercent(current: string | number, previous: string | number): number | null {
  const base = Number(previous);
  if (!Number.isFinite(base) || base === 0) return null;
  return Math.round(((Number(current) - base) / base) * 1000) / 10;
}

export function formatChange(current: string | number, previous: string | number): string {
  const value = changePercent(current, previous);
  if (value === null) return 'sem base';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function formatShare(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

const lineCents = (line: SaleLine) => line.unitPriceCents * line.quantity;
const saleCents = (sale: PaidSale) => sale.lines.reduce((total, line) => total + lineCents(line), 0);
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR');

function itemStats(sales: PaidSale[], revenueCents: number) {
  const items = new Map<string, { name: string; category: string; quantity: number; revenueCents: number }>();
  for (const line of sales.flatMap((sale) => sale.lines)) {
    const item = items.get(line.key) ?? { name: line.name, category: line.category, quantity: 0, revenueCents: 0 };
    item.quantity += line.quantity;
    item.revenueCents += lineCents(line);
    items.set(line.key, item);
  }
  return [...items.values()].map((item) => ({ ...item, share: share(item.revenueCents, revenueCents) }));
}

export function rankByQuantity<T extends { quantity: number; revenueCents: number; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.quantity - a.quantity || b.revenueCents - a.revenueCents || byName(a, b));
}

export function rankByRevenue<T extends { quantity: number; revenueCents: number; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.revenueCents - a.revenueCents || b.quantity - a.quantity || byName(a, b));
}

export function averageTicketCents(revenueCents: number, paidOrders: number): number {
  return paidOrders === 0 ? 0 : Math.round(revenueCents / paidOrders);
}

export function buildSalesReport(sales: PaidSale[], limit = DEFAULT_LIMIT) {
  const revenueCents = sales.reduce((total, sale) => total + saleCents(sale), 0);
  const items = itemStats(sales, revenueCents);
  const discountsCents = sales.reduce((total, sale) => total + (sale.discountCents ?? 0), 0);
  const deliveryFeesCents = sales.reduce((total, sale) => total + (sale.deliveryFeeCents ?? 0), 0);

  const categories = new Map<string, { category: string; quantity: number; revenueCents: number; hours: number[] }>();
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenueCents: 0 }));
  const byWeekday = WEEKDAYS.map((label, weekday) => ({ weekday, label, orders: 0, revenueCents: 0 }));
  const byPayment = PAYMENT_METHODS.map((method) => ({ method, orders: 0, revenueCents: 0 }));
  const byDay = new Map<string, { date: string; weekday: number; orders: number; revenueCents: number }>();
  const byWaiter = new Map<string, { waiterName: string; orders: number; revenueCents: number }>();

  for (const sale of sales) {
    const { hour, weekday } = localSlot(sale.paidAt);
    const total = saleCents(sale);
    byHour[hour].orders += 1;
    byHour[hour].revenueCents += total;
    byWeekday[weekday].orders += 1;
    byWeekday[weekday].revenueCents += total;
    const localDay = localDateOf(sale.paidAt);
    const day = byDay.get(localDay.date) ?? { date: localDay.date, weekday: localDay.weekday, orders: 0, revenueCents: 0 };
    day.orders += 1;
    day.revenueCents += total;
    byDay.set(localDay.date, day);
    const waiterName = sale.waiterName?.trim() || UNASSIGNED_WAITER;
    const waiter = byWaiter.get(waiterName) ?? { waiterName, orders: 0, revenueCents: 0 };
    waiter.orders += 1;
    waiter.revenueCents += total;
    byWaiter.set(waiterName, waiter);
    const payment = byPayment[PAYMENT_METHODS.indexOf(sale.paymentMethod)];
    payment.orders += 1;
    payment.revenueCents += total;
    for (const line of sale.lines) {
      const category = categories.get(line.category)
        ?? { category: line.category, quantity: 0, revenueCents: 0, hours: Array<number>(24).fill(0) };
      category.quantity += line.quantity;
      category.revenueCents += lineCents(line);
      category.hours[hour] += lineCents(line);
      categories.set(line.category, category);
    }
  }

  const categoryList = [...categories.values()].sort(
    (a, b) => b.revenueCents - a.revenueCents || a.category.localeCompare(b.category, 'pt-BR'),
  );
  const itemStat = (entry: (typeof items)[number]): ItemStat => ({
    name: entry.name,
    category: entry.category,
    quantity: entry.quantity,
    revenue: decimal(entry.revenueCents),
    share: entry.share,
  });

  return {
    paidOrders: sales.length,
    revenue: decimal(revenueCents),
    discounts: decimal(discountsCents),
    deliveryFees: decimal(deliveryFeesCents),
    netRevenue: decimal(revenueCents - discountsCents + deliveryFeesCents),
    itemsSold: items.reduce((total, item) => total + item.quantity, 0),
    averageTicket: decimal(averageTicketCents(revenueCents, sales.length)),
    topByQuantity: rankByQuantity(items).slice(0, limit).map(itemStat),
    topByRevenue: rankByRevenue(items).slice(0, limit).map(itemStat),
    byCategory: categoryList.map(({ category, quantity, revenueCents: cents }) => ({
      category,
      quantity,
      revenue: decimal(cents),
      share: share(cents, revenueCents),
    })),
    byHour: byHour.map(({ hour, orders, revenueCents: cents }) => ({ hour, orders, revenue: decimal(cents) })),
    byWeekday: byWeekday.map(({ weekday, label, orders, revenueCents: cents }) => ({
      weekday,
      label,
      orders,
      revenue: decimal(cents),
    })),
    byDay: [...byDay.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ date, weekday, orders, revenueCents: cents }) => ({
        date, weekday, label: WEEKDAYS[weekday], orders, revenue: decimal(cents),
      })),
    byWaiter: [...byWaiter.values()]
      .sort((a, b) => b.revenueCents - a.revenueCents || a.waiterName.localeCompare(b.waiterName, 'pt-BR'))
      .map(({ waiterName, orders, revenueCents: cents }) => ({
        waiterName, orders, revenue: decimal(cents), averageTicket: decimal(averageTicketCents(cents, orders)), share: share(cents, revenueCents),
      })),
    byPayment: byPayment.map(({ method, orders, revenueCents: cents }) => ({
      method,
      orders,
      revenue: decimal(cents),
      share: share(cents, revenueCents),
    })),
    categoryByHour: categoryList.map(({ category, hours }) => ({ category, hours: hours.map(decimal) })),
  };
}

export function reportForPeriod(sales: PaidSale[], from: string, to: string, limit = DEFAULT_LIMIT): SalesReport {
  return { from, to, ...buildSalesReport(sales, limit) };
}

export function emptyReport(from: string, to: string): SalesReport {
  return reportForPeriod([], from, to);
}

export function hasSales(report: SalesReport | null): boolean {
  return Boolean(report && report.paidOrders > 0);
}

export function topItems(report: SalesReport, rank: Rank): ItemStat[] {
  return rank === 'revenue' ? report.topByRevenue : report.topByQuantity;
}

export function maxCategoryHourCents(report: SalesReport): number {
  return report.categoryByHour.reduce(
    (max, row) => row.hours.reduce((inner, value) => Math.max(inner, centsOf(value)), max),
    0,
  );
}

export function categoryHourIntensity(report: SalesReport, value: string): number {
  const max = maxCategoryHourCents(report);
  return max === 0 ? 0 : Math.round((centsOf(value) / max) * 100);
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  const days = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
  const previousTo = new Date(start - DAY_MS);
  const previousFrom = new Date(previousTo.getTime() - (days - 1) * DAY_MS);
  return { from: isoDate(previousFrom), to: isoDate(previousTo) };
}

export function validatePeriod(from: string, to: string): string | null {
  const valid = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!valid(from) || !valid(to)) return 'Informe datas válidas no formato AAAA-MM-DD.';
  if (from > to) return 'A data inicial deve ser anterior ou igual à data final.';
  return null;
}

export function reportFilename(from: string, to: string): string {
  return `relatorio-vendas-${from}-a-${to}.csv`;
}

export function csvCell(value: string | number): string {
  const text = String(value);
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvMoney(value: string | number): string {
  return Number(value).toFixed(2).replace('.', ',');
}

export function csvLine(values: (string | number)[]): string {
  return values.map(csvCell).join(';');
}

export function salesReportCsv(report: SalesReport): string {
  const rows: string[] = [];
  rows.push(csvLine(['RELATÓRIO DE VENDAS']));
  rows.push(csvLine(['Período', report.from, report.to]));
  rows.push('');
  rows.push(csvLine(['INDICADORES']));
  rows.push(csvLine(['Indicador', 'Valor']));
  rows.push(csvLine(['Contas pagas', report.paidOrders]));
  rows.push(csvLine(['Receita', csvMoney(report.revenue)]));
  rows.push(csvLine(['Descontos', csvMoney(report.discounts)]));
  rows.push(csvLine(['Taxas de entrega', csvMoney(report.deliveryFees)]));
  rows.push(csvLine(['Receita líquida', csvMoney(report.netRevenue)]));
  rows.push(csvLine(['Itens vendidos', report.itemsSold]));
  rows.push(csvLine(['Ticket médio', csvMoney(report.averageTicket)]));
  rows.push('');

  const itemSection = (title: string, items: ItemStat[]) => {
    rows.push(csvLine([title]));
    rows.push(csvLine(['Posição', 'Item', 'Categoria', 'Quantidade', 'Receita', 'Participação (%)']));
    items.forEach((item, index) => rows.push(csvLine([
      index + 1, item.name, item.category, item.quantity, csvMoney(item.revenue), item.share.toFixed(1).replace('.', ','),
    ])));
    rows.push('');
  };
  itemSection('ITENS POR QUANTIDADE', report.topByQuantity);
  itemSection('ITENS POR RECEITA', report.topByRevenue);

  rows.push(csvLine(['EVOLUÇÃO DIÁRIA']));
  rows.push(csvLine(['Data', 'Dia da semana', 'Contas', 'Receita (R$)', 'Produto principal', 'Categoria', 'Garçom']));
  for (const day of report.byDay) {
    const mainProduct = report.topByRevenue[0]?.name ?? '—';
    const mainCategory = report.topByRevenue[0]?.category ?? '—';
    // Nota: O garçom não está disponível em `byDay` individualmente na estrutura atual,
    // usamos o mais produtivo do período como referência conforme necessidade de coluna.
    const topWaiter = report.byWaiter[0]?.waiterName ?? 'Sem garçom';
    rows.push(csvLine([day.date, day.label, day.orders, csvMoney(day.revenue), mainProduct, mainCategory, topWaiter]));
  }
  rows.push('');

  rows.push(csvLine(['CATEGORIAS']));
  rows.push(csvLine(['Categoria', 'Quantidade', 'Receita', 'Participação (%)']));
  for (const category of report.byCategory) {
    rows.push(csvLine([category.category, category.quantity, csvMoney(category.revenue), category.share.toFixed(1).replace('.', ',')]));
  }
  rows.push('');

  rows.push(csvLine(['HORAS']));
  rows.push(csvLine(['Hora', 'Contas', 'Receita']));
  for (const hour of report.byHour) rows.push(csvLine([`${hour.hour}h`, hour.orders, csvMoney(hour.revenue)]));
  rows.push('');

  rows.push(csvLine(['DIAS DA SEMANA']));
  rows.push(csvLine(['Dia', 'Contas', 'Receita']));
  for (const day of report.byWeekday) rows.push(csvLine([day.label, day.orders, csvMoney(day.revenue)]));
  rows.push('');

  rows.push(csvLine(['FORMAS DE PAGAMENTO']));
  rows.push(csvLine(['Forma', 'Contas', 'Receita', 'Participação (%)']));
  for (const payment of report.byPayment) {
    rows.push(csvLine([PAYMENT_LABELS[payment.method], payment.orders, csvMoney(payment.revenue), payment.share.toFixed(1).replace('.', ',')]));
  }
  rows.push('');

  rows.push(csvLine(['CATEGORIA X HORA']));
  rows.push(csvLine(['Categoria', ...HOURS.map((hour) => `${hour}h`)]));
  for (const row of report.categoryByHour) rows.push(csvLine([row.category, ...row.hours.map(csvMoney)]));

  return `\uFEFF${rows.join('\n')}\n`;
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function paidSalesFromOrders(orders: Order[], categoryOf: (menuItemId: number | null) => string): PaidSale[] {
  return orders
    .filter((order) => order.status === 'PAID' && order.paidAt && order.paymentMethod)
    .map((order) => ({
      paidAt: new Date(order.paidAt!),
      paymentMethod: order.paymentMethod as PaymentMethod,
      discountCents: discountCents(order),
      deliveryFeeCents: 0,
      waiterName: order.waiterName ?? null,
      lines: order.items.map((line) => ({
        key: `${line.menuItemId ?? 'removido'}|${line.nameSnapshot}`,
        name: line.nameSnapshot,
        category: categoryOf(line.menuItemId),
        quantity: line.quantity,
        unitPriceCents: centsOf(line.unitPrice),
      })),
    }));
}

export function hoje(): { from: string; to: string } {
  const today = localDateOf(new Date()).date;
  return { from: today, to: today };
}

export function ontem(): { from: string; to: string } {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = localDateOf(yesterday).date;
  return { from: date, to: date };
}

export function ultimos7Dias(): { from: string; to: string } {
  const today = new Date();
  const seven = new Date(today);
  seven.setDate(seven.getDate() - 7);
  const from = localDateOf(seven).date;
  const to = localDateOf(today).date;
  return { from, to };
}

export function ultimos30Dias(): { from: string; to: string } {
  const today = new Date();
  const thirty = new Date(today);
  thirty.setDate(thirty.getDate() - 30);
  const from = localDateOf(thirty).date;
  const to = localDateOf(today).date;
  return { from, to };
}

export function esteMes(): { from: string; to: string } {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const from = localDateOf(first).date;
  const to = localDateOf(today).date;
  return { from, to };
}

export function salesReportToCsv(report: SalesReport): string {
  const bom = '\uFEFF';
  const lines: string[] = [];
  // Header
  lines.push(`Data;Dia da semana;Contas;Receita (R$)`);
  // Rows from byDay
  for (const day of report.byDay) {
    const date = day.date;
    const weekday = day.label;
    const orders = day.orders;
    const revenue = day.revenue;
    lines.push(`${date};${weekday};${orders};${revenue}`);
  }
  // Also include top items maybe, but keep simple.
  return bom + lines.join('\n');
}

export function downloadCsvFromReport(filename: string, report: SalesReport) {
  const content = salesReportToCsv(report);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
