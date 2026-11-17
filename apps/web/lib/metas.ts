// Tela de metas de vendas e comparativo (SPEC/2026-11-17-tela-de-metas.md).
// Funções puras: recebem os dados como a API devolve e preparam a tela.

export type Goal = { month: string; revenue: string | null; orders: number | null; averageTicket: string | null };
export type Summary = { revenue: string; orders: number; averageTicket: string };
export type Window = { from: string; to: string };
export type Metric = 'revenue' | 'orders' | 'averageTicket';
export type ByMetric<T> = Record<Metric, T>;

export type GoalProgress = {
  month: string;
  goal: Goal | null;
  window: Window;
  actual: Summary;
  attainment: ByMetric<number | null>;
  previous: Summary & { window: Window };
  variation: ByMetric<number | null>;
};

export type PeriodComparison = {
  current: Summary & { window: Window };
  previous: Summary & { window: Window };
  variation: ByMetric<number | null>;
};

export type GoalForm = Record<Metric, string>;

export const METRICS: Metric[] = ['revenue', 'orders', 'averageTicket'];
export const metricLabels: ByMetric<string> = { revenue: 'Receita', orders: 'Comandas', averageTicket: 'Ticket médio' };

export const GOAL_ERRORS: ByMetric<string> & { empty: string } = {
  revenue: 'Informe uma meta de receita válida.',
  orders: 'Informe uma meta de comandas válida.',
  averageTicket: 'Informe uma meta de ticket médio válida.',
  empty: 'Informe pelo menos uma meta: receita, comandas ou ticket médio.',
};

// Valor em reais digitado: "50.000,00", "50000.5", "R$ 1.234,56". Vazio -> null; inválido -> NaN.
export function parseReais(raw: string): number | null {
  const compact = raw.replace(/R\$/i, '').replace(/\s+/g, '');
  if (!compact) return null;
  const normalized = compact.includes(',') ? compact.replace(/\./g, '').replace(',', '.') : compact;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

// Inteiro sem casas. Vazio -> null; inválido -> NaN.
export function parseCount(raw: string): number | null {
  const text = raw.trim().replace(/\./g, '');
  if (!text) return null;
  return /^\d+$/.test(text) ? Number(text) : Number.NaN;
}

function parsed(form: GoalForm) {
  return { revenue: parseReais(form.revenue), orders: parseCount(form.orders), averageTicket: parseReais(form.averageTicket) };
}

// RN-01.
export function validateGoalForm(form: GoalForm): string | null {
  const values = parsed(form);
  for (const metric of METRICS) {
    const value = values[metric];
    if (value !== null && (Number.isNaN(value) || value <= 0)) return GOAL_ERRORS[metric];
  }
  if (METRICS.every((metric) => values[metric] === null)) return GOAL_ERRORS.empty;
  return null;
}

// RF-04: vazio envia null, que tira aquela meta.
export function goalBody(form: GoalForm): ByMetric<number | null> {
  return parsed(form);
}

const decimalText = (value: string | null) => (value === null ? '' : Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function goalForm(goal: Goal | null): GoalForm {
  return {
    revenue: decimalText(goal?.revenue ?? null),
    orders: goal?.orders === null || goal?.orders === undefined ? '' : String(goal.orders),
    averageTicket: decimalText(goal?.averageTicket ?? null),
  };
}

const two = (value: number) => String(value).padStart(2, '0');

export function currentMonth(today = new Date()): string {
  return `${today.getFullYear()}-${two(today.getMonth() + 1)}`;
}

// RN-02: navegação entre meses, virando o ano.
export function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(year, index - 1 + delta, 1);
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}`;
}

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function monthLabel(month: string): string {
  const [year, index] = month.split('-').map(Number);
  const name = MONTH_NAMES[index - 1] ?? month;
  return `${name[0].toUpperCase()}${name.slice(1)} de ${year}`;
}

export const yearOf = (month: string) => month.slice(0, 4);

// RNF-01: "87,5%".
export function percentLabel(value: number | null): string {
  if (value === null) return '—';
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

// RNF-01: "+12,3%", "−4,0%", "sem base".
export function variationLabel(value: number | null): string {
  if (value === null) return 'sem base';
  const text = Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (value === 0) return `${text}%`;
  return `${value > 0 ? '+' : '−'}${text}%`;
}

export function variationTone(value: number | null): 'up' | 'down' | 'flat' {
  if (value === null || value === 0) return 'flat';
  return value > 0 ? 'up' : 'down';
}

// RF-03: a barra vai de 0 a 100% de largura; o número pode passar de 100.
export function barWidth(attainment: number | null): number {
  if (attainment === null || attainment <= 0) return 0;
  return Math.min(100, attainment);
}

export function goalValueLabel(metric: Metric, goal: Goal | null, money: (value: string) => string): string {
  const value = goal?.[metric] ?? null;
  if (value === null) return 'sem meta';
  return metric === 'orders' ? String(value) : money(String(value));
}

export function actualValueLabel(metric: Metric, summary: Summary, money: (value: string) => string): string {
  return metric === 'orders' ? String(summary.orders) : money(summary[metric]);
}

// RN-03.
export function validateComparePeriod(period: { from: string; to: string }): string | null {
  if (!period.from || !period.to) return 'Informe as duas datas do período.';
  if (period.from > period.to) return 'A data inicial deve ser anterior ou igual à data final.';
  return null;
}

// Janela da API em dias do aparelho: o "to" é exclusivo, então mostra o dia anterior.
export function windowLabel(window: Window): string {
  const start = new Date(window.from);
  const end = new Date(new Date(window.to).getTime() - 1);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 'sem dias';
  const day = (date: Date) => `${two(date.getUTCDate())}/${two(date.getUTCMonth() + 1)}`;
  return `${day(start)} a ${day(end)}`;
}
