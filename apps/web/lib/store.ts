import { apiRequest } from './api-client';
import { localRequest } from './local-store';
import { localDate, money, orderTotal, orderTotalCents } from './format';
import type { Expense, MenuItem, Order, OrderItem, Report, Table } from './types';

export type { Expense, MenuItem, Order, OrderItem, Report, Table };
export { money, orderTotal, orderTotalCents, localDate };

export type Mode = 'api' | 'local';

export const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? '').trim();

let mode: Mode = apiBaseUrl ? 'api' : 'local';
const listeners = new Set<() => void>();

export function getMode(): Mode {
  return mode;
}

/** Troca manual de modo (usuário escolheu operar local ou no servidor). */
export function setMode(next: Mode) {
  if (next === mode) return;
  mode = next;
  listeners.forEach((listener) => listener());
}

export function subscribeMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Requisição no modo ativo: API quando configurada, localStorage quando não. */
export async function storeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (mode === 'api') return apiRequest<T>(apiBaseUrl, path, init);
  return localRequest<T>(path, init);
}

/** Verifica se a API responde. Usado na faixa de estado do app. */
export async function checkApi(): Promise<boolean> {
  if (!apiBaseUrl) return false;
  try {
    await apiRequest<{ status?: string }>(apiBaseUrl, '/health');
    return true;
  } catch {
    return false;
  }
}
