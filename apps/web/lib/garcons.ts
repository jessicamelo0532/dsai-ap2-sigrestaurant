// Tela de garçons e relatório de comissão (SPEC/2026-11-17-tela-de-garcons.md).
// Funções puras: recebem os dados como a API devolve e preparam a tela.
import { localDay } from './reservas';

export type Waiter = {
  id: number;
  name: string;
  commissionRate: string;
  active: boolean;
};

export type WaiterReportRow = {
  waiterId: number | null;
  name: string;
  paidOrders: number;
  revenue: string;
  averageTicket: string;
  commission: string;
};

export type WaiterReport = {
  from: string;
  to: string;
  waiters: WaiterReportRow[];
  totals: { paidOrders: number; revenue: string; commission: string };
};

export const MAX_COMMISSION = 30;
export const DEFAULT_COMMISSION = 10;

// RN-02: "12,5", "12.5", "12,5%" -> 12.5. Vazio -> null (usa o padrão da API). Inválido -> NaN.
export function parseRate(raw: string): number | null {
  const text = raw.replace('%', '').replace(/\s+/g, '').replace(',', '.');
  if (!text) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return Number.NaN;
  return Number(text);
}

// RNF-01: 10 -> "10%", 12.5 -> "12,5%".
export function rateLabel(value: string | number): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

const nameLength = (name: string) => name.trim().replace(/\s+/g, ' ').length;

// RN-01 e RN-02.
export function validateWaiterForm(form: { name: string; commissionRate: string }): string | null {
  const length = nameLength(form.name);
  if (length < 2 || length > 80) return 'Informe o nome do garçom (2 a 80 caracteres).';
  const rate = parseRate(form.commissionRate);
  if (rate !== null && (Number.isNaN(rate) || rate > MAX_COMMISSION)) {
    return `Informe a comissão de 0 a ${MAX_COMMISSION}%, com até 2 casas.`;
  }
  return null;
}

// Corpo do POST: sem comissão, a API aplica o padrão.
export function createBody(form: { name: string; commissionRate: string }) {
  const rate = parseRate(form.commissionRate);
  return { name: form.name.trim().replace(/\s+/g, ' '), ...(rate !== null ? { commissionRate: rate } : {}) };
}

// Corpo do PATCH: só o que mudou.
export function updateBody(waiter: Waiter, form: { name: string; commissionRate: string }) {
  const body: { name?: string; commissionRate?: number } = {};
  const name = form.name.trim().replace(/\s+/g, ' ');
  if (name !== waiter.name) body.name = name;
  const rate = parseRate(form.commissionRate);
  if (rate !== null && rate !== Number(waiter.commissionRate)) body.commissionRate = rate;
  return body;
}

// RF-02: ativos primeiro, depois por nome.
export function sortWaiters(waiters: readonly Waiter[]): Waiter[] {
  return [...waiters].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'pt-BR'));
}

export function waiterCounts(waiters: readonly Waiter[]) {
  const active = waiters.filter((waiter) => waiter.active).length;
  return { active, inactive: waiters.length - active };
}

// RF-06: do dia 1º do mês até hoje.
export function monthToDate(today = new Date()): { from: string; to: string } {
  return { from: localDay(new Date(today.getFullYear(), today.getMonth(), 1)), to: localDay(today) };
}

// RN-03.
export function validatePeriod(period: { from: string; to: string }): string | null {
  if (!period.from || !period.to) return 'Informe as duas datas do período.';
  if (period.from > period.to) return 'A data inicial deve ser anterior ou igual à data final.';
  return null;
}

export function ordersLabel(count: number): string {
  return count === 1 ? '1 conta' : `${count} contas`;
}
