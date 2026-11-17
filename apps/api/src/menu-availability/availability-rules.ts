// Regras puras da disponibilidade por horário (SPEC/2026-11-16-cardapio-por-horario.md).
import { BadRequestException } from '@nestjs/common';
import { LOCAL_OFFSET_HOURS, WEEKDAYS } from '../sales-reports/sales-rules';

export interface TimeWindow {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export const MAX_WINDOWS = 28;
const DAY_MINUTES = 24 * 60;
const TIME_MESSAGE = 'Informe o horário no formato HH:MM.';

// RN-02: "HH:MM" vira minutos do dia; "24:00" só vale como fim.
export function parseTime(value: unknown, allowEndOfDay: boolean): number {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) throw new BadRequestException(TIME_MESSAGE);
  const [hours, minutes] = value.split(':').map(Number);
  if (allowEndOfDay && hours === 24 && minutes === 0) return DAY_MINUTES;
  if (hours > 23 || minutes > 59) throw new BadRequestException(TIME_MESSAGE);
  return hours * 60 + minutes;
}

export function formatTime(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

// RN-01 a RN-05: valida e devolve as janelas em ordem de dia e início.
export function parseWindows(input: unknown): TimeWindow[] {
  if (!Array.isArray(input)) throw new BadRequestException('Informe a lista de janelas.');
  if (input.length > MAX_WINDOWS) throw new BadRequestException(`Cadastre no máximo ${MAX_WINDOWS} janelas por item.`);
  const windows = input.map((raw) => {
    const { weekday, start, end } = (raw ?? {}) as { weekday?: unknown; start?: unknown; end?: unknown };
    if (typeof weekday !== 'number' || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw new BadRequestException('Informe o dia da semana de 0 (domingo) a 6 (sábado).');
    }
    const startMinute = parseTime(start, false);
    const endMinute = parseTime(end, true);
    if (startMinute >= endMinute) throw new BadRequestException('O horário de início deve ser antes do fim.');
    return { weekday, startMinute, endMinute };
  });
  const sorted = windows.sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
  for (let i = 1; i < sorted.length; i += 1) {
    const [before, current] = [sorted[i - 1], sorted[i]];
    if (before.weekday === current.weekday && current.startMinute < before.endMinute) {
      throw new BadRequestException(`As janelas de ${WEEKDAYS[current.weekday]} se sobrepõem.`);
    }
  }
  return sorted;
}

// P-2: dia da semana e minuto do dia no horário de Belém.
export function localMoment(date: Date) {
  const local = new Date(date.getTime() + LOCAL_OFFSET_HOURS * 60 * 60 * 1000);
  return { weekday: local.getUTCDay(), minute: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

// RN-06 e RN-07
export function isOpenAt(windows: readonly TimeWindow[], date: Date): boolean {
  if (!windows.length) return true;
  const { weekday, minute } = localMoment(date);
  return windows.some((w) => w.weekday === weekday && w.startMinute <= minute && minute < w.endMinute);
}

// RN-08: próximo início de janela nos 7 dias seguintes (o 7º é o mesmo dia da semana que vem).
export function nextOpening(windows: readonly TimeWindow[], date: Date) {
  const { weekday, minute } = localMoment(date);
  for (let daysAhead = 0; daysAhead <= 7; daysAhead += 1) {
    const day = (weekday + daysAhead) % 7;
    const starts = windows
      .filter((w) => w.weekday === day && (daysAhead > 0 || w.startMinute > minute))
      .map((w) => w.startMinute);
    if (starts.length) return { daysAhead, weekday: day, minute: Math.min(...starts) };
  }
  return null;
}

export function unavailableMessage(windows: readonly TimeWindow[], date: Date): string {
  const next = nextOpening(windows, date);
  const base = 'Este item não está disponível neste horário.';
  if (!next) return base;
  const day = next.daysAhead === 0 ? 'hoje' : WEEKDAYS[next.weekday];
  return `${base} Volta ${day} às ${formatTime(next.minute)}.`;
}

// RF-02
export function describeWindow(window: TimeWindow) {
  return {
    weekday: window.weekday,
    day: WEEKDAYS[window.weekday],
    start: formatTime(window.startMinute),
    end: formatTime(window.endMinute),
  };
}
