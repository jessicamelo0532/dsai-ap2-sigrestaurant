import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTable, prisma, resetDatabase } from './support/database';
import { book, reservations, reservationsController, setClock } from './support/reservations';

beforeEach(async () => {
  await resetDatabase();
  setClock('2026-11-12T12:00:00.000Z');
});
afterAll(() => prisma.$disconnect());

describe('criar reserva', () => {
  it('CA-01: agenda com fim calculado, número da mesa e dados limpos', async () => {
    const table = await createTable(5, 4);

    const reservation = await book(table.id, {
      customerName: '  Maria Lúcia  ',
      customerPhone: ' (91) 98888-7777 ',
      partySize: 4,
      startsAt: '2026-11-20T19:00:00-03:00',
      durationMinutes: 90,
      notes: '  Aniversário  ',
    });

    expect(reservation).toMatchObject({
      tableId: table.id,
      tableNumber: 5,
      customerName: 'Maria Lúcia',
      customerPhone: '(91) 98888-7777',
      partySize: 4,
      status: 'BOOKED',
      notes: 'Aniversário',
    });
    expect(reservation.startsAt.toISOString()).toBe('2026-11-20T22:00:00.000Z');
    expect(reservation.endsAt.toISOString()).toBe('2026-11-20T23:30:00.000Z');
  });

  it('deixa telefone e observações vazios como nulos', async () => {
    const table = await createTable(1);

    const reservation = await book(table.id, { customerPhone: '', notes: '   ' });

    expect(reservation.customerPhone).toBeNull();
    expect(reservation.notes).toBeNull();
  });

  it('CA-02: recusa horário sobreposto na mesma mesa', async () => {
    const table = await createTable(1);
    await book(table.id, { startsAt: '2026-11-20T19:00:00.000Z' });

    await expect(book(table.id, { startsAt: '2026-11-20T20:00:00.000Z' })).rejects.toThrow(
      'A mesa 1 já está reservada nesse horário.',
    );
    expect(await prisma.reservation.count()).toBe(1);
  });

  it('CA-02: aceita horário encostado na mesma mesa e o mesmo horário em outra mesa', async () => {
    const first = await createTable(1);
    const second = await createTable(2);
    await book(first.id, { startsAt: '2026-11-20T19:00:00.000Z' });

    await expect(book(first.id, { startsAt: '2026-11-20T21:00:00.000Z' })).resolves.toMatchObject({ status: 'BOOKED' });
    await expect(book(first.id, { startsAt: '2026-11-20T17:00:00.000Z' })).resolves.toMatchObject({ status: 'BOOKED' });
    await expect(book(second.id, { startsAt: '2026-11-20T19:00:00.000Z' })).resolves.toMatchObject({ status: 'BOOKED' });
  });

  it('reserva cancelada ou com falta não bloqueia o horário; com chegada marcada, bloqueia', async () => {
    const table = await createTable(1);
    const cancelled = await book(table.id);
    await reservations.cancel(cancelled.id);

    const again = await book(table.id);
    setClock('2026-11-20T19:05:00.000Z');
    await reservations.seat(again.id);

    await expect(book(table.id, { startsAt: '2026-11-20T20:00:00.000Z' })).rejects.toThrow(BadRequestException);
  });

  it('CA-03: recusa grupo maior que a mesa sem gravar nada', async () => {
    const table = await createTable(3, 2);

    await expect(book(table.id, { partySize: 3 })).rejects.toThrow('A mesa 3 comporta no máximo 2 pessoas.');
    expect(await prisma.reservation.count()).toBe(0);
  });

  it('CA-03: recusa horário passado, antecedência maior que 90 dias e duração fora do limite', async () => {
    const table = await createTable(1);

    await expect(book(table.id, { startsAt: '2026-11-12T11:59:00.000Z' })).rejects.toThrow(
      'A reserva precisa começar no futuro.',
    );
    await expect(book(table.id, { startsAt: '2027-02-11T12:00:00.000Z' })).rejects.toThrow(
      'Só é possível reservar com até 90 dias de antecedência.',
    );
    await expect(book(table.id, { durationMinutes: 400 })).rejects.toThrow('entre 30 e 360 minutos');
    await expect(book(table.id, { startsAt: '20/11/2026 19h' })).rejects.toThrow('ISO 8601');
  });

  it('avisa quando a mesa não existe', async () => {
    await expect(book(999)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('agenda do dia', () => {
  it('lista só as reservas que começam no dia, em ordem de horário e de mesa', async () => {
    const one = await createTable(1);
    const two = await createTable(2);
    await book(two.id, { customerName: 'Noite mesa 2', startsAt: '2026-11-20T21:00:00.000Z' });
    await book(one.id, { customerName: 'Almoço', startsAt: '2026-11-20T12:00:00.000Z' });
    await book(one.id, { customerName: 'Noite mesa 1', startsAt: '2026-11-20T21:00:00.000Z' });
    await book(one.id, { customerName: 'Outro dia', startsAt: '2026-11-21T00:00:00.000Z' });

    const agenda = await reservationsController.list('2026-11-20');

    expect(agenda.map((reservation) => reservation.customerName)).toEqual(['Almoço', 'Noite mesa 1', 'Noite mesa 2']);
  });

  it('filtra por situação', async () => {
    const table = await createTable(1);
    const lunch = await book(table.id, { customerName: 'Almoço', startsAt: '2026-11-20T12:00:00.000Z' });
    await book(table.id, { customerName: 'Jantar', startsAt: '2026-11-20T20:00:00.000Z' });
    await reservations.cancel(lunch.id);

    const cancelled = await reservationsController.list('2026-11-20', 'CANCELLED');
    const booked = await reservationsController.list('2026-11-20', 'BOOKED');

    expect(cancelled.map((reservation) => reservation.customerName)).toEqual(['Almoço']);
    expect(booked.map((reservation) => reservation.customerName)).toEqual(['Jantar']);
  });

  it('recusa data e situação inválidas', () => {
    expect(() => reservationsController.list('20/11/2026')).toThrow('Informe a data no formato AAAA-MM-DD.');
    expect(() => reservationsController.list('2026-11-20', 'CONFIRMADA')).toThrow(
      'Situação inválida. Use BOOKED, SEATED, CANCELLED, NO_SHOW.',
    );
  });

  it('consulta uma reserva pelo id', async () => {
    const table = await createTable(1);
    const reservation = await book(table.id);

    await expect(reservationsController.get(reservation.id)).resolves.toMatchObject({ customerName: 'Ana Souza' });
    await expect(reservationsController.get(999)).rejects.toThrow('Reserva não encontrada.');
  });
});

describe('CA-06: mesas livres', () => {
  it('mostra só mesas sem conflito e com lugares suficientes, da menor para a maior', async () => {
    await createTable(1, 2);
    const four = await createTable(2, 4);
    await createTable(3, 6);
    await createTable(4, 4);
    await book(four.id, { startsAt: '2026-11-20T19:00:00.000Z' });

    const free = await reservationsController.availability('2026-11-20T20:00:00.000Z', '3');

    expect(free.map((table) => table.number)).toEqual([4, 3]);
    expect(free[0]).not.toHaveProperty('reservations');
  });

  it('considera a duração pedida para achar conflito', async () => {
    const table = await createTable(1, 4);
    await book(table.id, { startsAt: '2026-11-20T19:00:00.000Z' });

    const shortBefore = await reservationsController.availability('2026-11-20T18:00:00.000Z', '2', '60');
    const longBefore = await reservationsController.availability('2026-11-20T18:00:00.000Z', '2', '90');

    expect(shortBefore).toHaveLength(1);
    expect(longBefore).toHaveLength(0);
  });

  it('recusa número de pessoas inválido ou horário fora da janela', async () => {
    await expect(reservationsController.availability('2026-11-20T19:00:00.000Z', 'dois')).rejects.toThrow(
      'Informe o número de pessoas entre 1 e 100.',
    );
    await expect(reservationsController.availability('2026-11-20T19:00:00.000Z', '0')).rejects.toThrow(
      BadRequestException,
    );
    await expect(reservationsController.availability('2026-11-01T19:00:00.000Z', '2')).rejects.toThrow(
      'A reserva precisa começar no futuro.',
    );
  });
});
