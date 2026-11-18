import type { Order, Table } from './types';

// Visão do salão (SPEC/2026-11-16-visao-do-salao.md).
// Funções puras: recebem as mesas como a rota /tables devolve e montam o painel.

export type FloorFilter = 'todas' | 'ocupadas' | 'livres';

// P-2 da SPEC: intervalo provisório de atualização automática do painel.
export const FLOOR_REFRESH_MS = 30_000;

export type FloorLine = { name: string; unitPriceCents: number; quantity: number; subtotalCents: number };

export type FloorTable = {
  id: number;
  number: number;
  capacity: number;
  orderId: number | null;
  openedAt: string | null;
  minutesOpen: number | null;
  lines: FloorLine[];
  itemCount: number;
  totalCents: number;
};

export type FloorSummary = {
  tables: number;
  occupied: number;
  free: number;
  openTotalCents: number;
  oldest: { number: number; minutesOpen: number } | null;
};

const MINUTE = 60_000;
const toCents = (value: string) => Math.round(Number(value) * 100);

// RN-02: minutos inteiros desde a abertura, nunca negativo.
export function minutesOpen(openedAt: string, now: Date): number {
  const diff = now.getTime() - new Date(openedAt).getTime();
  return Number.isFinite(diff) && diff > 0 ? Math.floor(diff / MINUTE) : 0;
}

// RN-02: "agora", "N min" ou "H h MM min".
export function formatElapsed(minutes: number): string {
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

// RF-04 e RN-03: mesmo nome e mesmo preço viram uma linha, na ordem do primeiro lançamento.
export function groupLines(order: Order): FloorLine[] {
  const groups = new Map<string, FloorLine>();
  for (const item of order.items) {
    const unitPriceCents = toCents(item.unitPrice);
    const key = `${item.nameSnapshot}|${unitPriceCents}`;
    const line = groups.get(key);
    if (line) {
      line.quantity += item.quantity;
      line.subtotalCents += unitPriceCents * item.quantity;
    } else {
      groups.set(key, {
        name: item.nameSnapshot,
        unitPriceCents,
        quantity: item.quantity,
        subtotalCents: unitPriceCents * item.quantity,
      });
    }
  }
  return [...groups.values()];
}

// RF-03, RF-05 e RN-01: mesa ocupada é a que tem comanda aberta.
export function buildFloor(tables: Table[], now: Date): FloorTable[] {
  return tables.map((table) => {
    const base = { id: table.id, number: table.number, capacity: table.capacity };
    if (!table.order) {
      return { ...base, orderId: null, openedAt: null, minutesOpen: null, lines: [], itemCount: 0, totalCents: 0 };
    }
    const lines = groupLines(table.order);
    return {
      ...base,
      orderId: table.order.id,
      openedAt: table.order.openedAt,
      minutesOpen: minutesOpen(table.order.openedAt, now),
      lines,
      itemCount: lines.reduce((total, line) => total + line.quantity, 0),
      totalCents: lines.reduce((total, line) => total + line.subtotalCents, 0),
    };
  });
}

const isOccupied = (table: FloorTable) => table.orderId !== null;

// RF-02
export function summarizeFloor(floor: FloorTable[]): FloorSummary {
  const occupied = sortFloor(floor).filter(isOccupied);
  const oldest = occupied[0];
  return {
    tables: floor.length,
    occupied: occupied.length,
    free: floor.length - occupied.length,
    openTotalCents: occupied.reduce((total, table) => total + table.totalCents, 0),
    oldest: oldest ? { number: oldest.number, minutesOpen: oldest.minutesOpen ?? 0 } : null,
  };
}

// RF-07: ocupadas primeiro, da conta mais antiga para a mais nova (empate pelo número); depois as livres.
export function sortFloor<T extends FloorTable>(floor: readonly T[]): T[] {
  return [...floor].sort((a, b) => {
    if (isOccupied(a) !== isOccupied(b)) return isOccupied(a) ? -1 : 1;
    const byTime = (b.minutesOpen ?? 0) - (a.minutesOpen ?? 0);
    return byTime || a.number - b.number;
  });
}

// RF-06
// Genérica para manter campos extras, como a zona (SPEC/2026-11-17-zonas-do-salao.md).
export function filterFloor<T extends FloorTable>(floor: readonly T[], filter: FloorFilter): T[] {
  const sorted = sortFloor(floor);
  if (filter === 'ocupadas') return sorted.filter(isOccupied);
  if (filter === 'livres') return sorted.filter((table) => !isOccupied(table));
  return sorted;
}

export function filterCounts(floor: FloorTable[]): Record<FloorFilter, number> {
  const occupied = floor.filter(isOccupied).length;
  return { todas: floor.length, ocupadas: occupied, livres: floor.length - occupied };
}
