import { describe, expect, it } from 'vitest';
import {
  deleteBlocker, duplicateZone, filterByZone, groupByZone, nextSortOrder, occupancyLabel, sortZones, tablesLabel,
  validateZoneName, withZones, ZONE_MESSAGES, type Zone,
} from './zonas';

// SPEC/2026-11-17-zonas-do-salao.md (T-04)
const zones: Zone[] = [
  { id: 2, name: 'Varanda', sortOrder: 2 },
  { id: 1, name: 'Salão', sortOrder: 1 },
];

describe('nome e ordem (RN-01, RN-02, RN-06)', () => {
  it('valida de 2 a 40 caracteres depois de limpar espaços', () => {
    expect(validateZoneName('  Área   externa ')).toBeNull();
    expect(validateZoneName(' V ')).toBe(ZONE_MESSAGES.name);
    expect(validateZoneName('x'.repeat(41))).toBe(ZONE_MESSAGES.name);
  });

  it('acha nome repetido sem diferenciar maiúsculas, ignorando a própria zona', () => {
    expect(duplicateZone(zones, 'VARANDA')?.id).toBe(2);
    expect(duplicateZone(zones, 'varanda', 2)).toBeNull();
    expect(duplicateZone(zones, 'Terraço')).toBeNull();
    expect(ZONE_MESSAGES.duplicate('Varanda')).toBe('Já existe uma zona chamada Varanda.');
  });

  it('ordena e calcula a próxima posição', () => {
    expect(sortZones(zones).map((zone) => zone.name)).toEqual(['Salão', 'Varanda']);
    expect(nextSortOrder(zones)).toBe(3);
    expect(nextSortOrder([])).toBe(1);
  });
});

describe('exclusão (RN-03)', () => {
  it('bloqueia zona com mesas e a última zona', () => {
    expect(deleteBlocker(zones[0], zones, 2)).toBe(ZONE_MESSAGES.hasTables);
    expect(deleteBlocker(zones[0], zones, 0)).toBeNull();
    expect(deleteBlocker(zones[1], [zones[1]], 0)).toBe(ZONE_MESSAGES.lastZone);
  });
});

describe('dados antigos (RF-06, CA-06)', () => {
  it('sem zonas, cria a zona padrão com todas as mesas', () => {
    const result = withZones(undefined, [{ id: 1 }, { id: 2 }]);
    expect(result.zones).toEqual([{ id: 1, name: 'Salão', sortOrder: 1 }]);
    expect(result.tables).toEqual([{ id: 1, zoneId: 1 }, { id: 2, zoneId: 1 }]);
  });

  it('mantém zonas existentes e corrige mesa com zona desconhecida', () => {
    const result = withZones(zones, [{ id: 1, zoneId: 2 }, { id: 2, zoneId: 99 }, { id: 3 }]);
    expect(result.zones.map((zone) => zone.id)).toEqual([1, 2]);
    expect(result.tables.map((table) => table.zoneId)).toEqual([2, 1, 1]);
  });
});

describe('agrupar e filtrar (RF-07, CA-07)', () => {
  const tables = [
    { id: 1, zoneId: 1, orderId: 10 },
    { id: 2, zoneId: 2, orderId: null },
    { id: 3, zoneId: 2, orderId: 11 },
    { id: 4, zoneId: 99, orderId: null },
  ];

  it('um grupo por zona na ordem, contando ocupadas', () => {
    const groups = groupByZone(zones, tables);
    expect(groups.map((group) => [group.zone.name, group.tables.map((table) => table.id), group.occupied])).toEqual([
      ['Salão', [1, 4], 1],
      ['Varanda', [2, 3], 1],
    ]);
  });

  it('sem zonas, nenhum grupo', () => {
    expect(groupByZone([], tables)).toEqual([]);
  });

  it('filtra por zona', () => {
    expect(filterByZone(tables, 'todas')).toHaveLength(4);
    expect(filterByZone(tables, 2).map((table) => table.id)).toEqual([2, 3]);
  });

  it('rótulos', () => {
    expect(occupancyLabel(1, 2)).toBe('1 de 2 ocupadas');
    expect(occupancyLabel(0, 1)).toBe('0 de 1 ocupada');
    expect(occupancyLabel(0, 0)).toBe('sem mesas');
    expect(tablesLabel(1)).toBe('1 mesa');
    expect(tablesLabel(3)).toBe('3 mesas');
  });
});
