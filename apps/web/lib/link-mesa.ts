// Link por mesa e QR das mesas (SPEC/2026-11-17-pwa-e-qr-das-mesas.md, RF-03, RF-05 e RN-01).
import type { Table } from './types';

export const TABLE_PARAM = 'mesa';

// Lê ?mesa=N; só aceita inteiro positivo.
export function tableNumberFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get(TABLE_PARAM);
  if (raw === null || !/^\d{1,4}$/.test(raw.trim())) return null;
  const number = Number(raw.trim());
  return number >= 1 ? number : null;
}

export type DeepLinkResult = { tableId: number } | { error: string };

// RF-03
export function resolveTableLink(tables: readonly Pick<Table, 'id' | 'number'>[], number: number): DeepLinkResult {
  const table = tables.find((entry) => entry.number === number);
  return table ? { tableId: table.id } : { error: `A mesa ${number} não existe neste salão.` };
}

// RN-01: endereço guardado no QR da mesa.
export function tableUrl(origin: string, number: number): string {
  return `${origin.replace(/\/+$/, '')}/?${TABLE_PARAM}=${number}`;
}

// Endereço sem o parâmetro da mesa, mantendo os demais.
export function withoutTableParam(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(TABLE_PARAM);
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}

export const tableTitle = (number: number) => `Mesa ${String(number).padStart(2, '0')}`;
