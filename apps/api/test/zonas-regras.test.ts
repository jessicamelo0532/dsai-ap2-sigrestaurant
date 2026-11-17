import { describe, expect, it } from 'vitest';
import {
  assertDeletable, DEFAULT_ZONE, duplicateMessage, HAS_TABLES_MESSAGE, LAST_ZONE_MESSAGE, NAME_MESSAGE, nextSortOrder, zoneName,
} from '../src/zones/zone-rules';

// SPEC/2026-11-17-zonas-do-salao.md (T-01)

describe('RN-01: nome da zona', () => {
  it('limpa espaços e aceita de 2 a 40 caracteres', () => {
    expect(zoneName('  Varanda   coberta ')).toBe('Varanda coberta');
    expect(zoneName('VIP')).toBe('VIP');
    expect(zoneName('x'.repeat(40))).toHaveLength(40);
  });

  it.each(['', ' a ', 'x'.repeat(41), 42, null, undefined])('recusa %s', (value) => {
    expect(() => zoneName(value)).toThrow(NAME_MESSAGE);
  });
});

describe('RN-02 e RN-04: mensagens e zona padrão', () => {
  it('cita o nome já existente e a zona padrão é "Salão"', () => {
    expect(duplicateMessage('Varanda')).toBe('Já existe uma zona chamada Varanda.');
    expect(DEFAULT_ZONE).toBe('Salão');
  });
});

describe('RN-03: exclusão', () => {
  it('permite zona vazia havendo outra', () => {
    expect(() => assertDeletable(0, 2)).not.toThrow();
  });

  it('recusa zona com mesas e a última zona', () => {
    expect(() => assertDeletable(3, 2)).toThrow(HAS_TABLES_MESSAGE);
    expect(() => assertDeletable(0, 1)).toThrow(LAST_ZONE_MESSAGE);
  });
});

describe('RN-06: ordem', () => {
  it('zona nova entra no fim', () => {
    expect(nextSortOrder([])).toBe(1);
    expect(nextSortOrder([1, 3, 2])).toBe(4);
  });
});
