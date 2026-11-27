// Estrutura programática do relatório de vendas (SPEC/2026-11-28-relatorios-vendas-export-json.md).
import { money } from './store';
import { PAYMENT_LABELS, formatShare, type SalesReport } from './sales-report';
import { salesInsights } from './sales-comparison';

export interface ExportItem {
  name: string;
  category: string;
  quantity: number;
  revenue: string;
  share: string;
}

export interface ExportCategory {
  category: string;
  quantity: number;
  revenue: string;
  share: string;
}

export interface ExportPayment {
  method: string;
  label: string;
  orders: number;
  revenue: string;
  share: string;
}

export interface ExportWeekday {
  weekday: number;
  label: string;
  orders: number;
  revenue: string;
}

export interface ExportHour {
  hour: number;
  orders: number;
  revenue: string;
}

export interface ExportInsight {
  title: string;
  text: string;
}

export interface ExportSummary {
  from: string;
  to: string;
  revenue: string;
  netRevenue: string;
  paidOrders: number;
  averageTicket: string;
}

export interface ExportJson {
  generatedAt: string;
  from: string;
  to: string;
  revenue: string;
  netRevenue: string;
  discounts: string;
  deliveryFees: string;
  paidOrders: number;
  averageTicket: string;
  itemsSold: number;
  categories: ExportCategory[];
  payments: ExportPayment[];
  weekdays: ExportWeekday[];
  hours: ExportHour[];
  topByQuantity: ExportItem[];
  topByRevenue: ExportItem[];
  insights: ExportInsight[];
  hasPrevious: boolean;
  previous: ExportSummary | null;
}

const item = (entry: SalesReport['topByQuantity'][number]): ExportItem => ({
  name: entry.name,
  category: entry.category,
  quantity: entry.quantity,
  revenue: money(entry.revenue),
  share: formatShare(entry.share),
});

const summary = (report: SalesReport): ExportSummary => ({
  from: report.from,
  to: report.to,
  revenue: report.revenue,
  netRevenue: report.netRevenue,
  paidOrders: report.paidOrders,
  averageTicket: report.averageTicket,
});

export function buildExportJson(current: SalesReport, previous: SalesReport | null): ExportJson {
  return {
    generatedAt: new Date().toISOString(),
    from: current.from,
    to: current.to,
    revenue: current.revenue,
    netRevenue: current.netRevenue,
    discounts: current.discounts,
    deliveryFees: current.deliveryFees,
    paidOrders: current.paidOrders,
    averageTicket: current.averageTicket,
    itemsSold: current.itemsSold,
    categories: current.byCategory.map((entry) => ({
      category: entry.category,
      quantity: entry.quantity,
      revenue: money(entry.revenue),
      share: formatShare(entry.share),
    })),
    payments: current.byPayment.map((entry) => ({
      method: entry.method,
      label: PAYMENT_LABELS[entry.method],
      orders: entry.orders,
      revenue: money(entry.revenue),
      share: formatShare(entry.share),
    })),
    weekdays: current.byWeekday.map((entry) => ({
      weekday: entry.weekday,
      label: entry.label,
      orders: entry.orders,
      revenue: money(entry.revenue),
    })),
    hours: current.byHour.map((entry) => ({
      hour: entry.hour,
      orders: entry.orders,
      revenue: money(entry.revenue),
    })),
    topByQuantity: current.topByQuantity.map(item),
    topByRevenue: current.topByRevenue.map(item),
    insights: salesInsights(current, previous ?? current),
    hasPrevious: previous !== null,
    previous: previous ? summary(previous) : null,
  };
}

export function exportJsonString(current: SalesReport, previous: SalesReport | null): string {
  return JSON.stringify(buildExportJson(current, previous), null, 2);
}

export function exportJsonFilename(current: SalesReport): string {
  return `relatorio-vendas-${current.from}-a-${current.to}.json`;
}
