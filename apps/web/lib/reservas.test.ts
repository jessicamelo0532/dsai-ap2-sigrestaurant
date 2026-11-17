import { describe, expect, it } from 'vitest';
import {
  allowedReservationActions, DEFAULT_DURATION, durationOptions, filterCounts, filterReservations,
  formatRange, formatTime, localDay, peopleLabel, reservationCountLabel, reservationFilters,
  statusLabels, tableLabel, toLocalIso, validateReservationForm, type Reservation,
} from './reservas';

const reservation = (overrides: Partial<Reservation> = {}): Reservation => ({
  id: 1, tableId: 3, tableNumber: 3, customerName: 'Ana', customerPhone: '91999999999',
  partySize: 2, startsAt: '2026-11-17T19:00:00.000Z', endsAt: '2026-11-17T21:00:00.000Z',
  status: 'BOOKED', notes: null, ...overrides,
});

const list: Reservation[] = [
  reservation({ id: 1, status: 'BOOKED' }),
  reservation({ id: 2, status: 'SEATED', tableNumber: 4 }),
  reservation({ id: 3, status: 'CANCELLED', tableNumber: 5 }),
  reservation({ id: 4, status: 'NO_SHOW', tableNumber: 6 }),
];

describe('situações e ações (RN-01 e RN-03)', () => {
  it('mostra os rótulos por extenso', () => {
    expect(statusLabels.BOOKED).toBe('Agendada');
    expect(statusLabels.SEATED).toBe('Cliente chegou');
    expect(statusLabels.CANCELLED).toBe('Cancelada');
    expect(statusLabels.NO_SHOW).toBe('Não compareceu');
  });

  it('só permite assentar, cancelar e marcar falta em reservas agendadas', () => {
    expect(allowedReservationActions('BOOKED')).toEqual(['seat', 'cancel', 'no-show']);
    expect(allowedReservationActions('SEATED')).toEqual([]);
    expect(allowedReservationActions('CANCELLED')).toEqual([]);
    expect(allowedReservationActions('NO_SHOW')).toEqual([]);
  });

  it('define os filtros da tela', () => {
    expect(reservationFilters.map((filter) => filter.id)).toEqual(['todas', 'BOOKED', 'SEATED', 'CANCELLED', 'NO_SHOW']);
  });
});

describe('filtros e contagens (RF-02)', () => {
  it('filtra por situação e mantém todas', () => {
    expect(filterReservations(list, 'todas')).toHaveLength(4);
    expect(filterReservations(list, 'BOOKED').map((entry) => entry.id)).toEqual([1]);
    expect(filterReservations(list, 'SEATED').map((entry) => entry.id)).toEqual([2]);
  });

  it('conta por situação', () => {
    expect(filterCounts(list)).toEqual({ todas: 4, BOOKED: 1, SEATED: 1, CANCELLED: 1, NO_SHOW: 1 });
  });

  it('não altera a lista recebida', () => {
    const original = [...list];
    filterReservations(list, 'BOOKED');
    expect(list).toEqual(original);
  });
});

describe('formatação', () => {
  it('formata horário e faixa', () => {
    const iso = new Date(2026, 10, 17, 19, 30).toISOString();
    const end = new Date(2026, 10, 17, 21, 0).toISOString();
    expect(formatTime(iso)).toBe('19:30');
    expect(formatRange(iso, end)).toBe('19:30–21:00');
  });

  it('usa --:-- para horário inválido', () => {
    expect(formatTime('nope')).toBe('--:--');
  });

  it('formata mesa e pessoas', () => {
    expect(tableLabel(3)).toBe('Mesa 03');
    expect(peopleLabel(1)).toBe('1 pessoa');
    expect(peopleLabel(4)).toBe('4 pessoas');
  });

  it('formata a contagem de reservas', () => {
    expect(reservationCountLabel(1)).toBe('1 reserva');
    expect(reservationCountLabel(4)).toBe('4 reservas');
  });
});

describe('duração e dia (RN-02)', () => {
  it('usa duração padrão de 120 min e passos de 30', () => {
    expect(DEFAULT_DURATION).toBe(120);
    expect(durationOptions).toEqual([30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360]);
  });

  it('gera o dia local no formato AAAA-MM-DD', () => {
    expect(localDay(new Date(2026, 10, 17))).toBe('2026-11-17');
    expect(localDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('validação e payload (RN-04)', () => {
  it('recusa nome curto, pessoas inválidas, início vazio e mesa ausente', () => {
    expect(validateReservationForm({ customerName: 'A', partySize: 2, startsAt: '2026-11-17T19:00', tableId: 1 })).toContain('nome');
    expect(validateReservationForm({ customerName: 'Ana', partySize: 0, startsAt: '2026-11-17T19:00', tableId: 1 })).toContain('pessoas');
    expect(validateReservationForm({ customerName: 'Ana', partySize: 2, startsAt: '', tableId: 1 })).toContain('horário');
    expect(validateReservationForm({ customerName: 'Ana', partySize: 2, startsAt: '2026-11-17T19:00', tableId: null })).toContain('mesa');
  });

  it('aceita formulário válido', () => {
    expect(validateReservationForm({ customerName: 'Ana', partySize: 2, startsAt: '2026-11-17T19:00', tableId: 3 })).toBeNull();
  });

  it('converte o horário local para ISO com fuso', () => {
    const iso = toLocalIso('2026-11-17T19:30');
    expect(iso).toMatch(/^2026-11-17T19:30:00[+-]\d{2}:\d{2}$/);
    expect(toLocalIso('invalido')).toBe('invalido');
  });
});
