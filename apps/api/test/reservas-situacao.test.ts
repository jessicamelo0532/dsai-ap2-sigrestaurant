import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CreateReservationDto, UpdateReservationDto } from '../src/reservations/reservation.dto';
import { createTable, prisma, resetDatabase, service } from './support/database';
import { book, reservations, reservationsController, setClock } from './support/reservations';

beforeEach(async () => {
  await resetDatabase();
  setClock('2026-11-12T12:00:00.000Z');
});
afterAll(() => prisma.$disconnect());

describe('CA-04: chegada, cancelamento e falta', () => {
  it('marca a chegada antes do fim e não deixa mudar de novo', async () => {
    const table = await createTable(1);
    const reservation = await book(table.id);
    setClock('2026-11-20T18:50:00.000Z');

    await expect(reservationsController.seat(reservation.id)).resolves.toMatchObject({ status: 'SEATED' });
    await expect(reservationsController.cancel(reservation.id)).rejects.toThrow(
      'Só reservas agendadas podem ser alteradas.',
    );
  });

  it('não marca chegada depois que o horário terminou', async () => {
    const table = await createTable(1);
    const reservation = await book(table.id);
    setClock('2026-11-20T21:00:00.000Z');

    await expect(reservations.seat(reservation.id)).rejects.toThrow('O horário desta reserva já terminou.');
    expect((await reservations.get(reservation.id)).status).toBe('BOOKED');
  });

  it('marca falta só depois do início', async () => {
    const table = await createTable(1);
    const reservation = await book(table.id);

    setClock('2026-11-20T18:59:00.000Z');
    await expect(reservationsController.markNoShow(reservation.id)).rejects.toThrow(
      'Só é possível marcar falta depois do horário da reserva.',
    );
    setClock('2026-11-20T19:20:00.000Z');
    await expect(reservationsController.markNoShow(reservation.id)).resolves.toMatchObject({ status: 'NO_SHOW' });
  });

  it('cancela reserva agendada uma única vez', async () => {
    const table = await createTable(1);
    const reservation = await book(table.id);

    await expect(reservationsController.cancel(reservation.id)).resolves.toMatchObject({ status: 'CANCELLED' });
    await expect(reservations.cancel(reservation.id)).rejects.toThrow('Só reservas agendadas podem ser alteradas.');
  });

  it('avisa quando a reserva não existe', async () => {
    await expect(reservations.seat(999)).rejects.toBeInstanceOf(NotFoundException);
    await expect(reservations.cancel(999)).rejects.toBeInstanceOf(NotFoundException);
    await expect(reservations.markNoShow(999)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CA-05: remarcação', () => {
  it('muda horário mantendo a duração original quando ela não é informada', async () => {
    const table = await createTable(1);
    const reservation = await book(table.id, { durationMinutes: 90 });

    const moved = await reservationsController.reschedule(reservation.id, { startsAt: '2026-11-21T20:00:00.000Z' });

    expect(moved.startsAt.toISOString()).toBe('2026-11-21T20:00:00.000Z');
    expect(moved.endsAt.toISOString()).toBe('2026-11-21T21:30:00.000Z');
  });

  it('muda de mesa, atualiza o número guardado e revalida a capacidade', async () => {
    const small = await createTable(1, 2);
    const big = await createTable(8, 6);
    const reservation = await book(small.id);

    const moved = await reservations.reschedule(reservation.id, { tableId: big.id, partySize: 5 });
    expect(moved).toMatchObject({ tableId: big.id, tableNumber: 8, partySize: 5 });

    await expect(reservations.reschedule(reservation.id, { tableId: small.id })).rejects.toThrow(
      'A mesa 1 comporta no máximo 2 pessoas.',
    );
  });

  it('não conta a própria reserva como conflito, mas recusa cair em cima de outra', async () => {
    const table = await createTable(1);
    const dinner = await book(table.id, { startsAt: '2026-11-20T19:00:00.000Z' });
    const late = await book(table.id, { startsAt: '2026-11-20T21:00:00.000Z' });

    await expect(reservations.reschedule(dinner.id, { startsAt: '2026-11-20T18:30:00.000Z' })).resolves.toBeTruthy();
    await expect(reservations.reschedule(late.id, { startsAt: '2026-11-20T20:00:00.000Z' })).rejects.toThrow(
      'A mesa 1 já está reservada nesse horário.',
    );
    expect((await reservations.get(late.id)).startsAt.toISOString()).toBe('2026-11-20T21:00:00.000Z');
  });

  it('atualiza dados do cliente e limpa telefone e observações enviados vazios', async () => {
    const table = await createTable(1);
    const reservation = await book(table.id, { customerPhone: '91 3222-1111', notes: 'Janela' });

    const updated = await reservations.reschedule(reservation.id, { customerName: ' Ana S. ', customerPhone: '', notes: '' });

    expect(updated).toMatchObject({ customerName: 'Ana S.', customerPhone: null, notes: null });
    expect(updated.startsAt.toISOString()).toBe(reservation.startsAt.toISOString());
  });

  it('recusa remarcar para o passado e remarcar reserva que não está agendada', async () => {
    const table = await createTable(1);
    const reservation = await book(table.id);

    await expect(reservations.reschedule(reservation.id, { startsAt: '2026-11-10T19:00:00.000Z' })).rejects.toThrow(
      'A reserva precisa começar no futuro.',
    );
    await reservations.cancel(reservation.id);
    await expect(reservations.reschedule(reservation.id, { partySize: 3 })).rejects.toThrow(
      'Só reservas agendadas podem ser alteradas.',
    );
    await expect(reservations.reschedule(999, { partySize: 3 })).rejects.toThrow('Reserva não encontrada.');
  });
});

describe('CA-07 e RN-09: remoção de mesa com reservas', () => {
  // A remoção de mesa usa a hora real, então a reserva é criada a partir de agora.
  async function bookFromNow(tableId: number, tableNumber: number, hoursAhead: number, status = 'BOOKED' as const) {
    const startsAt = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
    return prisma.reservation.create({
      data: {
        tableId,
        tableNumber,
        customerName: 'Cliente',
        partySize: 2,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000),
        status,
      },
    });
  }

  it('não remove mesa com reserva agendada que ainda não terminou', async () => {
    const table = await createTable(9);
    await bookFromNow(table.id, 9, 24);

    await expect(service.deleteTable(table.id)).rejects.toThrow(
      'Esta mesa tem reservas agendadas. Cancele ou remarque antes de remover.',
    );
  });

  it('remove depois do cancelamento e a reserva continua com o número da mesa', async () => {
    const table = await createTable(9);
    const reservation = await bookFromNow(table.id, 9, 24);
    await prisma.reservation.update({ where: { id: reservation.id }, data: { status: 'CANCELLED' } });

    await expect(service.deleteTable(table.id)).resolves.toEqual({ success: true });

    const history = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(history).toMatchObject({ tableId: null, tableNumber: 9 });
  });

  it('reserva agendada que já terminou não impede a remoção', async () => {
    const table = await createTable(9);
    await bookFromNow(table.id, 9, -5);

    await expect(service.deleteTable(table.id)).resolves.toEqual({ success: true });
  });

  it('remarcar reserva cuja mesa foi removida exige escolher outra mesa', async () => {
    const table = await createTable(9);
    const other = await createTable(10);
    const reservation = await book(table.id);
    await prisma.reservation.update({ where: { id: reservation.id }, data: { tableId: null } });

    await expect(reservations.reschedule(reservation.id, { partySize: 3 })).rejects.toThrow(
      'A mesa desta reserva foi removida. Escolha outra mesa.',
    );
    await expect(reservations.reschedule(reservation.id, { tableId: other.id })).resolves.toMatchObject({
      tableNumber: 10,
    });
  });
});

describe('RN-10: validação dos dados da reserva', () => {
  async function invalidFields<T extends object>(dto: new () => T, body: Record<string, unknown>) {
    const errors = await validate(plainToInstance(dto, body), { whitelist: true, forbidNonWhitelisted: true });
    return errors.map((error) => error.property).sort();
  }
  const valid = { tableId: 1, customerName: 'Ana', partySize: 2, startsAt: '2026-11-20T19:00:00Z' };

  it('aceita reserva mínima e recusa campos fora dos limites', async () => {
    expect(await invalidFields(CreateReservationDto, valid)).toEqual([]);
    expect(await invalidFields(CreateReservationDto, { ...valid, customerName: ' A ' })).toEqual(['customerName']);
    expect(await invalidFields(CreateReservationDto, { ...valid, partySize: 101 })).toEqual(['partySize']);
    expect(await invalidFields(CreateReservationDto, { ...valid, durationMinutes: 20 })).toEqual(['durationMinutes']);
    expect(await invalidFields(CreateReservationDto, { ...valid, notes: 'x'.repeat(501) })).toEqual(['notes']);
    expect(await invalidFields(CreateReservationDto, { ...valid, mesa: 3 })).toEqual(['mesa']);
  });

  it('telefone aceita formatos comuns e recusa letras', async () => {
    for (const customerPhone of ['(91) 98888-7777', '+55 91 3222 1111', '91988887777']) {
      expect(await invalidFields(CreateReservationDto, { ...valid, customerPhone })).toEqual([]);
    }
    expect(await invalidFields(CreateReservationDto, { ...valid, customerPhone: 'nove um' })).toEqual([
      'customerPhone',
    ]);
  });

  it('remarcação aceita corpo parcial', async () => {
    expect(await invalidFields(UpdateReservationDto, { partySize: 3 })).toEqual([]);
    expect(await invalidFields(UpdateReservationDto, { partySize: 0 })).toEqual(['partySize']);
  });
});
