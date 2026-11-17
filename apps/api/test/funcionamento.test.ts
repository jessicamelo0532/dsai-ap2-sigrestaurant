import 'reflect-metadata';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { OpeningHoursController } from '../src/opening-hours/opening-hours.controller';
import { OpeningHoursService } from '../src/opening-hours/opening-hours.service';
import { createTable, prisma, resetDatabase } from './support/database';
import { book, reservations, setClock } from './support/reservations';

// SPEC/2026-11-17-horario-de-funcionamento.md (T-02). Horário local de Belém (UTC−3).
// 20/11/2026 é sexta-feira; 21/11/2026 é sábado.
const hours = new OpeningHoursService(prisma);
const controller = new OpeningHoursController(hours);
const friday = { windows: [{ weekday: 5, start: '11:00', end: '15:00' }, { weekday: 5, start: '18:00', end: '23:00' }] };

beforeEach(async () => {
  await resetDatabase();
  setClock('2026-11-17T12:00:00.000Z');
});
afterAll(() => prisma.$disconnect());

describe('RF-01: cadastro do horário', () => {
  it('sem horário cadastrado; troca e limpa as janelas', async () => {
    expect(await controller.get()).toEqual({ configured: false, windows: [] });

    const saved = await controller.replace(friday);
    expect(saved).toEqual({ configured: true, windows: [
      { weekday: 5, day: 'sexta-feira', start: '11:00', end: '15:00' },
      { weekday: 5, day: 'sexta-feira', start: '18:00', end: '23:00' },
    ] });

    expect(await controller.replace({ windows: [] })).toEqual({ configured: false, windows: [] });
  });

  it('valida as janelas como o cardápio por horário', async () => {
    await expect(controller.replace({ windows: [{ weekday: 5, start: '18:00', end: '23:00' }, { weekday: 5, start: '22:00', end: '24:00' }] }))
      .rejects.toThrow('As janelas de sexta-feira se sobrepõem.');
    await expect(controller.replace({ windows: [{ weekday: 7, start: '18:00', end: '23:00' }] })).rejects.toThrow('Informe o dia da semana de 0 (domingo) a 6 (sábado).');
  });
});

describe('RF-02: reservas dentro do expediente', () => {
  it('CA-01: aceita sexta às 19:00 por 120 minutos', async () => {
    const table = await createTable(4);
    await hours.replace(friday);

    const reservation = await book(table.id, { startsAt: '2026-11-20T19:00:00-03:00', durationMinutes: 120 });
    expect(reservation.tableNumber).toBe(4);
  });

  it('CA-02: recusa passando do fim e em dia sem janela', async () => {
    const table = await createTable(4);
    await hours.replace(friday);

    await expect(book(table.id, { startsAt: '2026-11-20T22:00:00-03:00', durationMinutes: 120 }))
      .rejects.toThrow('A reserva fica fora do horário de funcionamento de sexta-feira: das 11:00 às 15:00 e das 18:00 às 23:00.');
    await expect(book(table.id, { startsAt: '2026-11-21T19:00:00-03:00' })).rejects.toThrow('A casa não abre sábado.');
    expect(await prisma.reservation.count()).toBe(0);
  });

  it('CA-03: a busca de mesas livres respeita o horário', async () => {
    await createTable(4);
    await hours.replace(friday);

    expect(await reservations.availability('2026-11-20T19:00:00-03:00', 2)).toHaveLength(1);
    await expect(reservations.availability('2026-11-21T19:00:00-03:00', 2)).rejects.toThrow('A casa não abre sábado.');
  });

  it('CA-04: remarcar para fora do expediente é recusado; mudar só o nome não confere', async () => {
    const table = await createTable(4);
    const reservation = await book(table.id, { startsAt: '2026-11-20T19:00:00-03:00' });
    await hours.replace({ windows: [{ weekday: 5, start: '20:00', end: '23:00' }] });

    await expect(reservations.reschedule(reservation.id, { startsAt: '2026-11-21T19:00:00-03:00' })).rejects.toThrow('A casa não abre sábado.');
    await expect(reservations.reschedule(reservation.id, { durationMinutes: 300 })).rejects.toThrow('fora do horário de funcionamento de sexta-feira');
    expect((await reservations.reschedule(reservation.id, { customerName: 'Ana Lima' })).customerName).toBe('Ana Lima');
  });

  it('CA-05: sem horário cadastrado, qualquer horário é aceito', async () => {
    const table = await createTable(4);
    expect((await book(table.id, { startsAt: '2026-11-21T03:00:00-03:00' })).tableNumber).toBe(4);
  });
});
