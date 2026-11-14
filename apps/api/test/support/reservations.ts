import { CreateReservationDto } from '../../src/reservations/reservation.dto';
import { ReservationsController } from '../../src/reservations/reservations.controller';
import { ReservationsService } from '../../src/reservations/reservations.service';
import { prisma } from './database';

// Relógio controlado pelos testes (o serviço recebe a função, não a hora fixa).
export const clock = { now: new Date('2026-11-12T12:00:00.000Z') };
export const reservations = new ReservationsService(prisma, () => clock.now);
export const reservationsController = new ReservationsController(reservations);

export function setClock(iso: string) {
  clock.now = new Date(iso);
}

export function book(tableId: number, overrides: Partial<CreateReservationDto> = {}) {
  return reservations.create({
    tableId,
    customerName: 'Ana Souza',
    partySize: 2,
    startsAt: '2026-11-20T19:00:00.000Z',
    ...overrides,
  });
}
