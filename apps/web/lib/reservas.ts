// Tela de reservas (SPEC/2026-11-17-tela-de-reservas.md).
// Funções puras: recebem as reservas como GET /reservations devolve e preparam a tela.

export type ReservationStatus = 'BOOKED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW';

export type Reservation = {
  id: number;
  tableId: number | null;
  tableNumber: number;
  customerName: string;
  customerPhone: string | null;
  partySize: number;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  notes: string | null;
};

export type AvailableTable = { id: number; number: number; capacity: number };

export const statusLabels: Record<ReservationStatus, string> = {
  BOOKED: 'Agendada',
  SEATED: 'Cliente chegou',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'Não compareceu',
};

export type ReservationFilter = 'todas' | ReservationStatus;

export const reservationFilters: { id: ReservationFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'BOOKED', label: 'Agendadas' },
  { id: 'SEATED', label: 'Cliente chegou' },
  { id: 'CANCELLED', label: 'Canceladas' },
  { id: 'NO_SHOW', label: 'Faltas' },
];

// RN-03: só reservas agendadas mudam de situação.
export function allowedReservationActions(status: ReservationStatus): ('seat' | 'cancel' | 'no-show')[] {
  return status === 'BOOKED' ? ['seat', 'cancel', 'no-show'] : [];
}

export const reservationActionLabels = { seat: 'Assentar', cancel: 'Cancelar', 'no-show': 'Marcar falta' } as const;

// RF-02
export function filterReservations(reservations: readonly Reservation[], filter: ReservationFilter): Reservation[] {
  if (filter === 'todas') return [...reservations];
  return reservations.filter((reservation) => reservation.status === filter);
}

export function filterCounts(reservations: readonly Reservation[]): Record<ReservationFilter, number> {
  const counts = { todas: reservations.length, BOOKED: 0, SEATED: 0, CANCELLED: 0, NO_SHOW: 0 };
  for (const reservation of reservations) counts[reservation.status] += 1;
  return counts;
}

// Horário no fuso do aparelho (a API devolve ISO com fuso/UTC).
export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(date.getHours())}:${two(date.getMinutes())}`;
}

export function formatRange(startsAt: string, endsAt: string): string {
  return `${formatTime(startsAt)}–${formatTime(endsAt)}`;
}

export function tableLabel(number: number): string {
  return `Mesa ${String(number).padStart(2, '0')}`;
}

export function peopleLabel(partySize: number): string {
  return partySize === 1 ? '1 pessoa' : `${partySize} pessoas`;
}

// RN-02: duração padrão 120 min, de 30 a 360 em passos de 30.
export const DEFAULT_DURATION = 120;
export const durationOptions = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360];

export function localDay(date = new Date()): string {
  const two = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

// RN-04 / RF-03: validação local simples; a API é a fonte final das regras de tempo.
export function validateReservationForm(form: { customerName: string; partySize: number; startsAt: string; tableId: number | null }): string | null {
  if (form.customerName.trim().replace(/\s+/g, ' ').length < 2) return 'Informe o nome do cliente (2 a 100 caracteres).';
  if (!Number.isInteger(form.partySize) || form.partySize < 1) return 'Informe o número de pessoas.';
  if (!form.startsAt) return 'Informe o dia e o horário da reserva.';
  if (form.tableId === null) return 'Escolha uma mesa livre para o horário.';
  return null;
}

// Converte "AAAA-MM-DDTHH:mm" (datetime-local) para ISO com o fuso do aparelho.
export function toLocalIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number, s = 2) => String(n).padStart(s, '0');
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function reservationCountLabel(count: number): string {
  return count === 1 ? '1 reserva' : `${count} reservas`;
}
