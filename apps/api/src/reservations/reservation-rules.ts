import { BadRequestException } from '@nestjs/common';

// Regras puras das reservas (SPEC/2026-11-12-reservas-de-mesa.md).
// Ficam fora do serviço para serem testadas sem banco.

// Valores provisórios até a resposta do cliente (perguntas P-1 e P-2 da SPEC).
export const DEFAULT_DURATION_MINUTES = 120;
export const MIN_DURATION_MINUTES = 30;
export const MAX_DURATION_MINUTES = 360;
export const MAX_ADVANCE_DAYS = 90;

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export type ReservationStatus = 'BOOKED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW';

export interface TimeSlot {
  startsAt: Date;
  endsAt: Date;
}

// Reservas que ainda ocupam a mesa no horário (RN-05).
export const ACTIVE_STATUSES: ReservationStatus[] = ['BOOKED', 'SEATED'];

// RN-02: o fim é o início mais a duração.
export function computeEnd(startsAt: Date, durationMinutes = DEFAULT_DURATION_MINUTES): Date {
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < MIN_DURATION_MINUTES ||
    durationMinutes > MAX_DURATION_MINUTES
  ) {
    throw new BadRequestException(
      `A duração da reserva deve ficar entre ${MIN_DURATION_MINUTES} e ${MAX_DURATION_MINUTES} minutos.`,
    );
  }
  return new Date(startsAt.getTime() + durationMinutes * MINUTE);
}

export function durationOf(slot: TimeSlot): number {
  return Math.round((slot.endsAt.getTime() - slot.startsAt.getTime()) / MINUTE);
}

// RN-05: horários encostados (um termina quando o outro começa) não se sobrepõem.
export function overlaps(a: TimeSlot, b: TimeSlot): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

// RN-03: começa no futuro e no máximo MAX_ADVANCE_DAYS dias à frente.
export function assertBookingWindow(startsAt: Date, now: Date): void {
  if (startsAt.getTime() <= now.getTime()) {
    throw new BadRequestException('A reserva precisa começar no futuro.');
  }
  if (startsAt.getTime() > now.getTime() + MAX_ADVANCE_DAYS * DAY) {
    throw new BadRequestException(`Só é possível reservar com até ${MAX_ADVANCE_DAYS} dias de antecedência.`);
  }
}

// RN-04: o grupo cabe na mesa.
export function assertCapacity(partySize: number, table: { number: number; capacity: number }): void {
  if (partySize > table.capacity) {
    throw new BadRequestException(`A mesa ${table.number} comporta no máximo ${table.capacity} pessoas.`);
  }
}

// RN-06: só reservas agendadas mudam de situação ou são remarcadas.
export function assertBooked(status: ReservationStatus): void {
  if (status !== 'BOOKED') {
    throw new BadRequestException('Só reservas agendadas podem ser alteradas.');
  }
}

// RN-07: chegada antes do fim; falta depois do início.
export function assertCanSeat(slot: TimeSlot, now: Date): void {
  if (now.getTime() >= slot.endsAt.getTime()) {
    throw new BadRequestException('O horário desta reserva já terminou.');
  }
}

export function assertCanMarkNoShow(slot: TimeSlot, now: Date): void {
  if (now.getTime() < slot.startsAt.getTime()) {
    throw new BadRequestException('Só é possível marcar falta depois do horário da reserva.');
  }
}

// RN-11: horário de início em ISO 8601 com fuso.
export function parseInstant(value: string | undefined, field = 'startsAt'): Date {
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
  const date = value && iso.test(value) ? new Date(value) : undefined;
  if (!date || Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Informe ${field} em ISO 8601 com fuso, por exemplo 2026-12-01T19:00:00-03:00.`);
  }
  return date;
}

// RN-11: um dia da agenda em UTC (pergunta P-3), devolvido como intervalo [início, início do dia seguinte).
export function parseDay(value: string | undefined): TimeSlot {
  const valid = value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const startsAt = new Date(`${value}T00:00:00.000Z`);
  if (!valid || Number.isNaN(startsAt.getTime()) || startsAt.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Informe a data no formato AAAA-MM-DD.');
  }
  return { startsAt, endsAt: new Date(startsAt.getTime() + DAY) };
}
