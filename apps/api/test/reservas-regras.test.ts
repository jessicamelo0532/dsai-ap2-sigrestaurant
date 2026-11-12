import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertBooked,
  assertBookingWindow,
  assertCanMarkNoShow,
  assertCanSeat,
  assertCapacity,
  computeEnd,
  durationOf,
  overlaps,
  parseDay,
  parseInstant,
} from '../src/reservations/reservation-rules';

const at = (iso: string) => new Date(iso);
const slot = (start: string, end: string) => ({ startsAt: at(start), endsAt: at(end) });
const now = at('2026-11-12T12:00:00.000Z');

describe('RN-02: duração e fim da reserva', () => {
  it('usa 120 minutos quando a duração não é informada', () => {
    expect(computeEnd(at('2026-11-20T19:00:00.000Z')).toISOString()).toBe('2026-11-20T21:00:00.000Z');
  });

  it('aceita os limites de 30 e 360 minutos', () => {
    expect(computeEnd(at('2026-11-20T19:00:00.000Z'), 30).toISOString()).toBe('2026-11-20T19:30:00.000Z');
    expect(computeEnd(at('2026-11-20T12:00:00.000Z'), 360).toISOString()).toBe('2026-11-20T18:00:00.000Z');
  });

  it.each([29, 361, 0, -60, 90.5])('recusa duração de %s minutos', (minutes) => {
    expect(() => computeEnd(at('2026-11-20T19:00:00.000Z'), minutes)).toThrow(
      'A duração da reserva deve ficar entre 30 e 360 minutos.',
    );
  });

  it('calcula a duração de volta a partir do horário', () => {
    expect(durationOf(slot('2026-11-20T19:00:00.000Z', '2026-11-20T20:30:00.000Z'))).toBe(90);
  });
});

describe('RN-05: sobreposição de horários', () => {
  const booked = slot('2026-11-20T19:00:00.000Z', '2026-11-20T21:00:00.000Z');

  it.each([
    ['começa no meio', '2026-11-20T20:00:00.000Z', '2026-11-20T22:00:00.000Z'],
    ['termina no meio', '2026-11-20T18:00:00.000Z', '2026-11-20T19:30:00.000Z'],
    ['fica dentro', '2026-11-20T19:30:00.000Z', '2026-11-20T20:00:00.000Z'],
    ['engloba', '2026-11-20T18:00:00.000Z', '2026-11-20T22:00:00.000Z'],
    ['é igual', '2026-11-20T19:00:00.000Z', '2026-11-20T21:00:00.000Z'],
  ])('sobrepõe quando %s', (_caso, start, end) => {
    expect(overlaps(booked, slot(start, end))).toBe(true);
    expect(overlaps(slot(start, end), booked)).toBe(true);
  });

  it.each([
    ['termina quando a outra começa', '2026-11-20T17:00:00.000Z', '2026-11-20T19:00:00.000Z'],
    ['começa quando a outra termina', '2026-11-20T21:00:00.000Z', '2026-11-20T23:00:00.000Z'],
    ['é em outro dia', '2026-11-21T19:00:00.000Z', '2026-11-21T21:00:00.000Z'],
  ])('não sobrepõe quando %s', (_caso, start, end) => {
    expect(overlaps(booked, slot(start, end))).toBe(false);
  });
});

describe('RN-03: janela de antecedência', () => {
  it('aceita do minuto seguinte até 90 dias à frente', () => {
    expect(() => assertBookingWindow(at('2026-11-12T12:01:00.000Z'), now)).not.toThrow();
    expect(() => assertBookingWindow(at('2027-02-10T12:00:00.000Z'), now)).not.toThrow();
  });

  it('recusa horário passado ou igual a agora', () => {
    expect(() => assertBookingWindow(now, now)).toThrow('A reserva precisa começar no futuro.');
    expect(() => assertBookingWindow(at('2026-11-01T19:00:00.000Z'), now)).toThrow(BadRequestException);
  });

  it('recusa mais de 90 dias de antecedência', () => {
    expect(() => assertBookingWindow(at('2027-02-10T12:00:01.000Z'), now)).toThrow(
      'Só é possível reservar com até 90 dias de antecedência.',
    );
  });
});

describe('RN-04: capacidade da mesa', () => {
  it('aceita grupo do tamanho da mesa e recusa maior', () => {
    expect(() => assertCapacity(4, { number: 3, capacity: 4 })).not.toThrow();
    expect(() => assertCapacity(5, { number: 3, capacity: 4 })).toThrow('A mesa 3 comporta no máximo 4 pessoas.');
  });
});

describe('RN-06 e RN-07: mudanças de situação', () => {
  const booking = slot('2026-11-12T19:00:00.000Z', '2026-11-12T21:00:00.000Z');

  it('só reserva agendada pode mudar', () => {
    expect(() => assertBooked('BOOKED')).not.toThrow();
    for (const status of ['SEATED', 'CANCELLED', 'NO_SHOW'] as const) {
      expect(() => assertBooked(status)).toThrow('Só reservas agendadas podem ser alteradas.');
    }
  });

  it('chegada pode ser marcada antes do fim, inclusive adiantada', () => {
    expect(() => assertCanSeat(booking, at('2026-11-12T18:40:00.000Z'))).not.toThrow();
    expect(() => assertCanSeat(booking, at('2026-11-12T20:59:00.000Z'))).not.toThrow();
    expect(() => assertCanSeat(booking, at('2026-11-12T21:00:00.000Z'))).toThrow('O horário desta reserva já terminou.');
  });

  it('falta só depois do início', () => {
    expect(() => assertCanMarkNoShow(booking, at('2026-11-12T18:59:00.000Z'))).toThrow(
      'Só é possível marcar falta depois do horário da reserva.',
    );
    expect(() => assertCanMarkNoShow(booking, at('2026-11-12T19:00:00.000Z'))).not.toThrow();
  });
});

describe('RN-11: formatos de data', () => {
  it('lê horário com fuso de Belém ou em UTC', () => {
    expect(parseInstant('2026-12-01T19:00:00-03:00').toISOString()).toBe('2026-12-01T22:00:00.000Z');
    expect(parseInstant('2026-12-01T19:00Z').toISOString()).toBe('2026-12-01T19:00:00.000Z');
  });

  it.each([undefined, '', '2026-12-01', '2026-12-01T19:00:00', 'amanhã às 19h', '2026-13-01T19:00:00Z'])(
    'recusa horário "%s"',
    (value) => {
      expect(() => parseInstant(value)).toThrow('Informe startsAt em ISO 8601 com fuso');
    },
  );

  it('transforma o dia em intervalo de 24 horas em UTC', () => {
    expect(parseDay('2026-11-20')).toEqual({
      startsAt: at('2026-11-20T00:00:00.000Z'),
      endsAt: at('2026-11-21T00:00:00.000Z'),
    });
  });

  it.each([undefined, '20/11/2026', '2026-2-01', '2026-02-30'])('recusa o dia "%s"', (value) => {
    expect(() => parseDay(value)).toThrow('Informe a data no formato AAAA-MM-DD.');
  });
});
