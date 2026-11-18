// Zonas do salão (SPEC/2026-11-17-zonas-do-salao.md).
// Funções puras usadas pela tela Salão, pela janela Zonas e pelo adaptador local.

export type Zone = { id: number; name: string; sortOrder: number; tableCount?: number };

// RN-04 (P-1)
export const DEFAULT_ZONE_NAME = 'Salão';

export const ZONE_MESSAGES = {
  name: 'Informe o nome da zona, de 2 a 40 caracteres.',
  notFound: 'Zona não encontrada.',
  hasTables: 'Mova as mesas desta zona antes de excluí-la.',
  lastZone: 'O salão precisa de pelo menos uma zona.',
  duplicate: (name: string) => `Já existe uma zona chamada ${name}.`,
};

export const cleanZoneName = (name: string) => name.trim().replace(/\s+/g, ' ');

// RN-01
export function validateZoneName(name: string): string | null {
  const length = cleanZoneName(name).length;
  return length < 2 || length > 40 ? ZONE_MESSAGES.name : null;
}

// RN-02: sem diferenciar maiúsculas e minúsculas; ignora a própria zona ao renomear.
export function duplicateZone(zones: readonly Zone[], name: string, ignoreId?: number): Zone | null {
  const key = cleanZoneName(name).toLocaleLowerCase('pt-BR');
  return zones.find((zone) => zone.id !== ignoreId && zone.name.toLocaleLowerCase('pt-BR') === key) ?? null;
}

// RN-06
export function sortZones<T extends Zone>(zones: readonly T[]): T[] {
  return [...zones].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export function nextSortOrder(zones: readonly Zone[]): number {
  return zones.reduce((max, zone) => Math.max(max, zone.sortOrder), 0) + 1;
}

// RN-03
export function deleteBlocker(zone: Zone, zones: readonly Zone[], tableCount: number): string | null {
  if (tableCount > 0) return ZONE_MESSAGES.hasTables;
  if (zones.filter((entry) => entry.id !== zone.id).length === 0) return ZONE_MESSAGES.lastZone;
  return null;
}

// RF-06: dados salvos antes das zonas ganham a zona padrão com todas as mesas.
export function withZones<T extends { id: number; zoneId?: number }>(
  zones: readonly Zone[] | undefined,
  tables: readonly T[],
): { zones: Zone[]; tables: (T & { zoneId: number })[] } {
  const list = Array.isArray(zones) && zones.length ? sortZones(zones) : [{ id: 1, name: DEFAULT_ZONE_NAME, sortOrder: 1 }];
  const fallback = list[0].id;
  const ids = new Set(list.map((zone) => zone.id));
  return {
    zones: list,
    tables: tables.map((table) => ({ ...table, zoneId: table.zoneId !== undefined && ids.has(table.zoneId) ? table.zoneId : fallback })),
  };
}

export type ZoneFilter = 'todas' | number;

// RF-07
export function filterByZone<T extends { zoneId?: number }>(tables: readonly T[], filter: ZoneFilter): T[] {
  return filter === 'todas' ? [...tables] : tables.filter((table) => table.zoneId === filter);
}

export type ZoneGroup<T> = { zone: Zone; tables: T[]; occupied: number };

// RF-07: um grupo por zona, na ordem das zonas; mesa com zona desconhecida vai para a primeira.
export function groupByZone<T extends { zoneId?: number; orderId?: number | null }>(
  zones: readonly Zone[],
  tables: readonly T[],
): ZoneGroup<T>[] {
  const ordered = sortZones(zones);
  if (!ordered.length) return [];
  const known = new Set(ordered.map((zone) => zone.id));
  const groups = new Map(ordered.map((zone) => [zone.id, [] as T[]]));
  for (const table of tables) {
    const id = table.zoneId !== undefined && known.has(table.zoneId) ? table.zoneId : ordered[0].id;
    groups.get(id)!.push(table);
  }
  return ordered.map((zone) => {
    const list = groups.get(zone.id)!;
    return { zone, tables: list, occupied: list.filter((table) => table.orderId != null).length };
  });
}

export function occupancyLabel(occupied: number, total: number): string {
  if (!total) return 'sem mesas';
  return `${occupied} de ${total} ocupada${total === 1 ? '' : 's'}`;
}

export function tablesLabel(count: number): string {
  return count === 1 ? '1 mesa' : `${count} mesas`;
}
