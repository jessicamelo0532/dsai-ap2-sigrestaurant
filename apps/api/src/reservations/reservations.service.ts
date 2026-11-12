import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma, Reservation } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateReservationDto, UpdateReservationDto } from './reservation.dto';
import {
  ACTIVE_STATUSES,
  assertBooked,
  assertBookingWindow,
  assertCanMarkNoShow,
  assertCanSeat,
  assertCapacity,
  computeEnd,
  durationOf,
  overlaps,
  parseInstant,
  ReservationStatus,
  TimeSlot,
} from './reservation-rules';

// O relógio é injetável para testar regras de tempo sem depender da hora real.
export const RESERVATION_CLOCK = 'RESERVATION_CLOCK';
export type Clock = () => Date;

type Table = { id: number; number: number; capacity: number };

@Injectable()
export class ReservationsService {
  private readonly now: Clock;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(RESERVATION_CLOCK) clock?: Clock,
  ) {
    this.now = clock ?? (() => new Date());
  }

  // RF-02: reservas que começam no dia, em ordem de horário.
  list(day: TimeSlot, status?: ReservationStatus) {
    return this.prisma.reservation.findMany({
      where: { startsAt: { gte: day.startsAt, lt: day.endsAt }, ...(status ? { status } : {}) },
      orderBy: [{ startsAt: 'asc' }, { tableNumber: 'asc' }],
    });
  }

  async get(id: number) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id } });
    if (!reservation) throw new NotFoundException('Reserva não encontrada.');
    return reservation;
  }

  // RF-01
  async create(dto: CreateReservationDto) {
    const startsAt = parseInstant(dto.startsAt);
    const slot = { startsAt, endsAt: computeEnd(startsAt, dto.durationMinutes) };
    assertBookingWindow(startsAt, this.now());
    return this.prisma.$transaction(async (tx) => {
      const table = await this.lockTable(tx, dto.tableId);
      assertCapacity(dto.partySize, table);
      await this.assertTableFree(tx, table, slot);
      return tx.reservation.create({
        data: {
          tableId: table.id,
          tableNumber: table.number,
          customerName: dto.customerName.trim(),
          customerPhone: dto.customerPhone?.trim() || null,
          partySize: dto.partySize,
          ...slot,
          notes: dto.notes?.trim() || null,
        },
      });
    });
  }

  // RF-04 e RN-08: remarcar revalida tudo, sem contar a própria reserva como conflito.
  async reschedule(id: number, dto: UpdateReservationDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Reserva não encontrada.');
      assertBooked(current.status);

      const startsAt = dto.startsAt !== undefined ? parseInstant(dto.startsAt) : current.startsAt;
      const slot = { startsAt, endsAt: computeEnd(startsAt, dto.durationMinutes ?? durationOf(current)) };
      if (dto.startsAt !== undefined) assertBookingWindow(startsAt, this.now());

      const tableId = dto.tableId ?? current.tableId;
      if (tableId === null) throw new BadRequestException('A mesa desta reserva foi removida. Escolha outra mesa.');
      const table = await this.lockTable(tx, tableId);
      const partySize = dto.partySize ?? current.partySize;
      assertCapacity(partySize, table);
      await this.assertTableFree(tx, table, slot, id);

      return tx.reservation.update({
        where: { id },
        data: {
          tableId: table.id,
          tableNumber: table.number,
          partySize,
          ...slot,
          ...(dto.customerName !== undefined ? { customerName: dto.customerName.trim() } : {}),
          ...(dto.customerPhone !== undefined ? { customerPhone: dto.customerPhone.trim() || null } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
        },
      });
    });
  }

  // RF-05, RF-06 e RF-07 (RN-06 e RN-07)
  seat(id: number) {
    return this.changeStatus(id, 'SEATED', assertCanSeat);
  }

  cancel(id: number) {
    return this.changeStatus(id, 'CANCELLED');
  }

  markNoShow(id: number) {
    return this.changeStatus(id, 'NO_SHOW', assertCanMarkNoShow);
  }

  // RF-08: mesas livres com capacidade suficiente, da menor para a maior.
  async availability(startsAtValue: string | undefined, partySize: number, durationMinutes?: number) {
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 100) {
      throw new BadRequestException('Informe o número de pessoas entre 1 e 100.');
    }
    const startsAt = parseInstant(startsAtValue);
    const slot = { startsAt, endsAt: computeEnd(startsAt, durationMinutes) };
    assertBookingWindow(startsAt, this.now());

    const tables = await this.prisma.diningTable.findMany({
      where: { capacity: { gte: partySize } },
      orderBy: [{ capacity: 'asc' }, { number: 'asc' }],
      include: { reservations: { where: { status: { in: ACTIVE_STATUSES }, endsAt: { gt: slot.startsAt } } } },
    });
    return tables
      .filter((table) => !table.reservations.some((reservation) => overlaps(reservation, slot)))
      .map(({ reservations: _reservations, ...table }) => table);
  }

  private async changeStatus(id: number, status: ReservationStatus, check?: (slot: Reservation, now: Date) => void) {
    const reservation = await this.get(id);
    assertBooked(reservation.status);
    check?.(reservation, this.now());
    return this.prisma.reservation.update({ where: { id }, data: { status } });
  }

  // RNF-02: trava a linha da mesa para duas reservas simultâneas não passarem juntas.
  private async lockTable(tx: Prisma.TransactionClient, tableId: number): Promise<Table> {
    await tx.$queryRaw`SELECT "id" FROM "DiningTable" WHERE "id" = ${tableId} FOR UPDATE`;
    const table = await tx.diningTable.findUnique({ where: { id: tableId } });
    if (!table) throw new NotFoundException('Mesa não encontrada.');
    return table;
  }

  // RN-05
  private async assertTableFree(tx: Prisma.TransactionClient, table: Table, slot: TimeSlot, ignoreId?: number) {
    const candidates = await tx.reservation.findMany({
      where: {
        tableId: table.id,
        status: { in: ACTIVE_STATUSES },
        endsAt: { gt: slot.startsAt },
        ...(ignoreId !== undefined ? { id: { not: ignoreId } } : {}),
      },
    });
    if (candidates.some((reservation) => overlaps(reservation, slot))) {
      throw new BadRequestException(`A mesa ${table.number} já está reservada nesse horário.`);
    }
  }
}
