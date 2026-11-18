import { describe, expect, it } from 'vitest';
import {
  MAX_WINDOWS, newRow, repeatOnWorkdays, sortWindows, statusLabel, toMinutes, toRows, validateWindows, windowLabel,
  windowsBody, WINDOW_MESSAGES,
} from './horarios';

// SPEC/2026-11-17-tela-de-horarios-do-cardapio.md (T-01)

describe('horário (RN-01)', () => {
  it.each([['00:00', 0], ['11:30', 690], ['23:59', 1439]])('%s', (value, minutes) => {
    expect(toMinutes(value)).toBe(minutes);
  });

  it('24:00 só vale como fim', () => {
    expect(toMinutes('24:00', true)).toBe(1440);
    expect(toMinutes('24:00')).toBeNull();
  });

  it.each(['9:00', '24:01', '12:60', 'meio-dia', ''])('recusa %s', (value) => {
    expect(toMinutes(value, true)).toBeNull();
  });
});

describe('janelas (RN-01 a RN-04)', () => {
  it('aceita janelas que encostam e dias diferentes', () => {
    expect(validateWindows([newRow(1, '11:00', '15:00'), newRow(1, '15:00', '18:00'), newRow(2, '11:00', '15:00')])).toBeNull();
    expect(validateWindows([newRow(6, '18:00', '24:00')])).toBeNull();
  });

  it('recusa formato, ordem e sobreposição', () => {
    expect(validateWindows([newRow(1, '9:00', '15:00')])).toBe(WINDOW_MESSAGES.time);
    expect(validateWindows([newRow(1, '15:00', '11:00')])).toBe(WINDOW_MESSAGES.order);
    expect(validateWindows([newRow(1, '11:00', '11:00')])).toBe(WINDOW_MESSAGES.order);
    expect(validateWindows([newRow(1, '14:00', '16:00'), newRow(1, '11:00', '15:00')])).toBe('As janelas de segunda-feira se sobrepõem.');
  });

  it('limita 28 janelas', () => {
    const many = Array.from({ length: MAX_WINDOWS + 1 }, (_, index) => newRow(index % 7, '11:00', '12:00'));
    expect(validateWindows(many)).toBe(WINDOW_MESSAGES.limit);
  });

  it('ordena por dia e início e monta o corpo', () => {
    const rows = [newRow(3, '18:00', '22:00'), newRow(1, '11:00', '15:00'), newRow(3, '11:00', '14:00')];
    expect(sortWindows(rows).map((row) => `${row.weekday} ${row.start}`)).toEqual(['1 11:00', '3 11:00', '3 18:00']);
    expect(windowsBody(rows)).toEqual({ windows: [
      { weekday: 1, start: '11:00', end: '15:00' },
      { weekday: 3, start: '11:00', end: '14:00' },
      { weekday: 3, start: '18:00', end: '22:00' },
    ] });
  });

  it('converte as janelas da API em linhas ordenadas', () => {
    const rows = toRows([{ weekday: 5, day: 'sexta-feira', start: '18:00', end: '23:00' }, { weekday: 0, start: '12:00', end: '16:00' }]);
    expect(rows.map((row) => [row.weekday, row.start, row.end])).toEqual([[0, '12:00', '16:00'], [5, '18:00', '23:00']]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(2);
  });
});

describe('repetir nos dias úteis (RF-03)', () => {
  it('copia para segunda a sexta sem duplicar', () => {
    const rows = repeatOnWorkdays([newRow(1, '11:00', '15:00'), newRow(3, '11:00', '15:00')], 0);
    expect(rows.map((row) => row.weekday)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.every((row) => row.start === '11:00' && row.end === '15:00')).toBe(true);
  });

  it('mantém outras janelas e ignora índice inválido', () => {
    const rows = repeatOnWorkdays([newRow(0, '12:00', '16:00'), newRow(2, '18:00', '22:00')], 1);
    expect(rows.map((row) => `${row.weekday} ${row.start}`)).toEqual(['0 12:00', '1 18:00', '2 18:00', '3 18:00', '4 18:00', '5 18:00']);
    expect(repeatOnWorkdays([newRow()], 5)).toHaveLength(1);
  });
});

describe('rótulos (RF-02)', () => {
  it('situação e janela por extenso', () => {
    expect(statusLabel({ alwaysAvailable: true, availableNow: true })).toBe('Sempre disponível');
    expect(statusLabel({ alwaysAvailable: false, availableNow: true })).toBe('Disponível agora');
    expect(statusLabel({ alwaysAvailable: false, availableNow: false })).toBe('Fora do horário agora');
    expect(windowLabel({ weekday: 6, start: '18:00', end: '24:00' })).toBe('sábado, 18:00 às 24:00');
  });
});
