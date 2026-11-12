import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CreateReservationDto, UpdateReservationDto } from './reservation.dto';
import { parseDay, ReservationStatus } from './reservation-rules';
import { ReservationsService } from './reservations.service';

const STATUSES: ReservationStatus[] = ['BOOKED', 'SEATED', 'CANCELLED', 'NO_SHOW'];

export function parseStatus(value?: string): ReservationStatus | undefined {
  if (value === undefined || value === '') return undefined;
  if (!STATUSES.includes(value as ReservationStatus)) {
    throw new BadRequestException(`Situação inválida. Use ${STATUSES.join(', ')}.`);
  }
  return value as ReservationStatus;
}

// Rotas de reservas (SPEC/2026-11-12-reservas-de-mesa.md, RF-01 a RF-08).
@Controller('api/reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get() list(@Query('date') date?: string, @Query('status') status?: string) {
    return this.reservations.list(parseDay(date), parseStatus(status));
  }

  // Declarada antes de ':id' para "availability" não ser lida como id.
  @Get('availability') availability(
    @Query('startsAt') startsAt?: string,
    @Query('partySize') partySize?: string,
    @Query('durationMinutes') durationMinutes?: string,
  ) {
    return this.reservations.availability(
      startsAt,
      Number(partySize),
      durationMinutes === undefined ? undefined : Number(durationMinutes),
    );
  }

  @Get(':id') get(@Param('id', ParseIntPipe) id: number) {
    return this.reservations.get(id);
  }

  @Post() create(@Body() dto: CreateReservationDto) {
    return this.reservations.create(dto);
  }

  @Patch(':id') reschedule(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateReservationDto) {
    return this.reservations.reschedule(id, dto);
  }

  @Post(':id/seat') seat(@Param('id', ParseIntPipe) id: number) {
    return this.reservations.seat(id);
  }

  @Post(':id/cancel') cancel(@Param('id', ParseIntPipe) id: number) {
    return this.reservations.cancel(id);
  }

  @Post(':id/no-show') markNoShow(@Param('id', ParseIntPipe) id: number) {
    return this.reservations.markNoShow(id);
  }
}
