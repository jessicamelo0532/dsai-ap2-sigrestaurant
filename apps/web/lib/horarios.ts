// Tela de horários do cardápio (SPEC/2026-11-17-tela-de-horarios-do-cardapio.md).
// Funções puras: validam as janelas como a API e preparam a tela.

export type AvailabilityWindow = { weekday: number; day?: string; start: string; end: string };
export type Availability = { menuItemId: number; alwaysAvailable: boolean; availableNow: boolean; windows: AvailabilityWindow[] };
export type WindowRow = { key: string; weekday: number; start: string; end: string };

export const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const WORKDAYS = [1, 2, 3, 4, 5];
export const MAX_WINDOWS = 28;

export const WINDOW_MESSAGES = {
  time: 'Informe o horário no formato HH:MM.',
  order: 'O horário de início deve ser antes do fim.',
  overlap: (weekday: number) => `As janelas de ${WEEKDAYS[weekday]} se sobrepõem.`,
  limit: `Cadastre no máximo ${MAX_WINDOWS} janelas por item.`,
};

// RN-01: minutos do dia; o fim aceita 24:00. Inválido -> null.
export function toMinutes(value: string, isEnd = false): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (isEnd && hours === 24 && minutes === 0) return 24 * 60;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

// RF-04: ordem de dia e de início.
export function sortWindows<T extends { weekday: number; start: string }>(windows: readonly T[]): T[] {
  return [...windows].sort((a, b) => a.weekday - b.weekday || (toMinutes(a.start) ?? 0) - (toMinutes(b.start) ?? 0));
}

// RN-01 a RN-04.
export function validateWindows(windows: readonly WindowRow[]): string | null {
  if (windows.length > MAX_WINDOWS) return WINDOW_MESSAGES.limit;
  const parsed = [];
  for (const window of windows) {
    const start = toMinutes(window.start);
    const end = toMinutes(window.end, true);
    if (start === null || end === null) return WINDOW_MESSAGES.time;
    if (start >= end) return WINDOW_MESSAGES.order;
    parsed.push({ weekday: window.weekday, start, end });
  }
  parsed.sort((a, b) => a.weekday - b.weekday || a.start - b.start);
  for (let index = 1; index < parsed.length; index += 1) {
    const previous = parsed[index - 1];
    const current = parsed[index];
    if (previous.weekday === current.weekday && current.start < previous.end) return WINDOW_MESSAGES.overlap(current.weekday);
  }
  return null;
}

export function windowsBody(windows: readonly WindowRow[]) {
  return { windows: sortWindows(windows).map(({ weekday, start, end }) => ({ weekday, start: start.trim(), end: end.trim() })) };
}

let counter = 0;
export const newRow = (weekday = 1, start = '11:00', end = '15:00'): WindowRow => ({ key: `j${++counter}`, weekday, start, end });

export function toRows(windows: readonly AvailabilityWindow[]): WindowRow[] {
  return sortWindows(windows).map((window) => newRow(window.weekday, window.start, window.end));
}

// RF-03: copia a janela para segunda a sexta, sem repetir o que já existe.
export function repeatOnWorkdays(rows: readonly WindowRow[], index: number): WindowRow[] {
  const source = rows[index];
  if (!source) return [...rows];
  const exists = (weekday: number) => rows.some((row) => row.weekday === weekday && row.start === source.start && row.end === source.end);
  const copies = WORKDAYS.filter((weekday) => !exists(weekday)).map((weekday) => newRow(weekday, source.start, source.end));
  return sortWindows([...rows, ...copies]);
}

// RF-02
export function statusLabel(availability: Pick<Availability, 'alwaysAvailable' | 'availableNow'>): string {
  if (availability.alwaysAvailable) return 'Sempre disponível';
  return availability.availableNow ? 'Disponível agora' : 'Fora do horário agora';
}

export function windowLabel(window: Pick<AvailabilityWindow, 'weekday' | 'start' | 'end'>): string {
  return `${WEEKDAYS[window.weekday]}, ${window.start} às ${window.end}`;
}
