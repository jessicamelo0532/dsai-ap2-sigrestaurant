import { describe, expect, it } from 'vitest';
import { resolveTableLink, tableNumberFromSearch, tableTitle, tableUrl, withoutTableParam } from './link-mesa';

// SPEC/2026-11-17-pwa-e-qr-das-mesas.md (T-03)

describe('link por mesa (RF-03, RN-01)', () => {
  it('lê o número da mesa do endereço', () => {
    expect(tableNumberFromSearch('?mesa=3')).toBe(3);
    expect(tableNumberFromSearch('?x=1&mesa=12')).toBe(12);
    expect(tableNumberFromSearch('?mesa=0')).toBeNull();
    expect(tableNumberFromSearch('?mesa=abc')).toBeNull();
    expect(tableNumberFromSearch('?mesa=12345')).toBeNull();
    expect(tableNumberFromSearch('')).toBeNull();
  });

  it('acha a mesa pelo número ou explica que não existe', () => {
    const tables = [{ id: 10, number: 1 }, { id: 30, number: 3 }];
    expect(resolveTableLink(tables, 3)).toEqual({ tableId: 30 });
    expect(resolveTableLink(tables, 99)).toEqual({ error: 'A mesa 99 não existe neste salão.' });
  });

  it('monta o endereço do QR e limpa o parâmetro', () => {
    expect(tableUrl('https://mesa.test/', 7)).toBe('https://mesa.test/?mesa=7');
    expect(withoutTableParam('/', '?mesa=7')).toBe('/');
    expect(withoutTableParam('/', '?mesa=7&modo=a')).toBe('/?modo=a');
    expect(tableTitle(7)).toBe('Mesa 07');
  });
});
