import { BadRequestException } from '@nestjs/common';

// Regras puras das zonas do salão (SPEC/2026-11-17-zonas-do-salao.md).

// RN-04 (P-1): zona padrão, que recebe as mesas sem zona.
export const DEFAULT_ZONE = 'Salão';

export const NAME_MESSAGE = 'Informe o nome da zona, de 2 a 40 caracteres.';
export const NOT_FOUND_MESSAGE = 'Zona não encontrada.';
export const HAS_TABLES_MESSAGE = 'Mova as mesas desta zona antes de excluí-la.';
export const LAST_ZONE_MESSAGE = 'O salão precisa de pelo menos uma zona.';

// RN-01 (P-2): espaços repetidos viram um; de 2 a 40 caracteres.
export function zoneName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 40) throw new BadRequestException(NAME_MESSAGE);
  return name;
}

export const duplicateMessage = (name: string) => `Já existe uma zona chamada ${name}.`;

// RN-03 (P-3): zona com mesas ou última zona não são excluídas.
export function assertDeletable(tableCount: number, zoneCount: number): void {
  if (tableCount > 0) throw new BadRequestException(HAS_TABLES_MESSAGE);
  if (zoneCount <= 1) throw new BadRequestException(LAST_ZONE_MESSAGE);
}

// RN-06: zona nova entra no fim da ordem.
export function nextSortOrder(orders: readonly number[]): number {
  return orders.reduce((max, value) => Math.max(max, value), 0) + 1;
}
