import { describe, expect, it } from 'vitest';
import {
  describeWindow,
  formatTime,
  isOpenAt,
  localMoment,
  nextOpening,
  parseTime,
  parseWindows,
  TimeWindow,
  unavailableMessage,
} from '../src/menu-availability/availability-rules';

// Regras puras da disponibilidade por horário (SPEC/2026-11-16-cardapio-por-horario.md).
// 16/11/2026 é segunda-feira. Belém é UTC−3: 14:00Z = 11:00 local.
const utc = (iso: string) => new Date(`${iso}.000Z`);
const lunchMonday: TimeWindow[] = [{ weekday: 1, startMinute: 11 * 60, endMinute: 15 * 60 }];

describe('RN-02: horário', () => {
  it('lê HH:MM em minutos do dia', () => {
    expect(parseTime('00:00', false)).toBe(0);
    expect(parseTime('11:30', false)).toBe(690);
    expect(parseTime('23:59', false)).toBe(1439);
    expect(parseTime('24:00', true)).toBe(1440);
  });

  it.each([
    ['24:00', false],
    ['24:01', true],
    ['25:00', true],
    ['12:60', false],
    ['9:00', false],
    ['09h00', false],
    [900, false],
    [undefined, true],
  ])('recusa %s (fim do dia: %s)', (value, allow) => {
    expect(() => parseTime(value, allow)).toThrow('Informe o horário no formato HH:MM.');
  });

  it('escreve minutos como HH:MM', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(545)).toBe('09:05');
    expect(formatTime(1440)).toBe('24:00');
  });
});

describe('RN-01 a RN-05: janelas', () => {
  it('ordena por dia e início', () => {
    expect(
      parseWindows([
        { weekday: 5, start: '18:00', end: '23:00' },
        { weekday: 1, start: '18:00', end: '22:00' },
        { weekday: 1, start: '11:00', end: '15:00' },
      ]),
    ).toEqual([
      { weekday: 1, startMinute: 660, endMinute: 900 },
      { weekday: 1, startMinute: 1080, endMinute: 1320 },
      { weekday: 5, startMinute: 1080, endMinute: 1380 },
    ]);
  });

  it('aceita lista vazia, janela até 24:00 e janelas que só encostam', () => {
    expect(parseWindows([])).toEqual([]);
    expect(
      parseWindows([
        { weekday: 0, start: '15:00', end: '24:00' },
        { weekday: 0, start: '00:00', end: '15:00' },
      ]),
    ).toEqual([
      { weekday: 0, startMinute: 0, endMinute: 900 },
      { weekday: 0, startMinute: 900, endMinute: 1440 },
    ]);
  });

  it('recusa sobreposição no mesmo dia, mas não em dias diferentes', () => {
    expect(() =>
      parseWindows([
        { weekday: 3, start: '11:00', end: '15:00' },
        { weekday: 3, start: '14:59', end: '18:00' },
      ]),
    ).toThrow('As janelas de quarta-feira se sobrepõem.');
    expect(parseWindows([
      { weekday: 3, start: '11:00', end: '15:00' },
      { weekday: 4, start: '11:00', end: '15:00' },
    ])).toHaveLength(2);
  });

  it.each([
    [{ weekday: 7, start: '10:00', end: '11:00' }, 'Informe o dia da semana de 0 (domingo) a 6 (sábado).'],
    [{ weekday: -1, start: '10:00', end: '11:00' }, 'Informe o dia da semana de 0 (domingo) a 6 (sábado).'],
    [{ weekday: 1.5, start: '10:00', end: '11:00' }, 'Informe o dia da semana de 0 (domingo) a 6 (sábado).'],
    [{ weekday: '1', start: '10:00', end: '11:00' }, 'Informe o dia da semana de 0 (domingo) a 6 (sábado).'],
    [null, 'Informe o dia da semana de 0 (domingo) a 6 (sábado).'],
    [{ weekday: 1, start: '24:00', end: '24:00' }, 'Informe o horário no formato HH:MM.'],
    [{ weekday: 1, start: '11:00', end: '11:00' }, 'O horário de início deve ser antes do fim.'],
    [{ weekday: 1, start: '22:00', end: '02:00' }, 'O horário de início deve ser antes do fim.'],
  ])('recusa %j', (window, message) => {
    expect(() => parseWindows([window])).toThrow(message);
  });

  it('recusa o que não é lista e mais de 28 janelas', () => {
    expect(() => parseWindows({ weekday: 1 })).toThrow('Informe a lista de janelas.');
    expect(() => parseWindows(undefined)).toThrow('Informe a lista de janelas.');
    const many = Array.from({ length: 29 }, (_, i) => ({ weekday: i % 7, start: `${String(Math.floor(i / 7)).padStart(2, '0')}:00`, end: `${String(Math.floor(i / 7)).padStart(2, '0')}:30` }));
    expect(() => parseWindows(many)).toThrow('Cadastre no máximo 28 janelas por item.');
    expect(parseWindows(many.slice(0, 28))).toHaveLength(28);
  });
});

describe('P-2: horário de Belém', () => {
  it('converte o instante para dia e minuto locais', () => {
    expect(localMoment(utc('2026-11-16T14:00:00'))).toEqual({ weekday: 1, minute: 660 });
    expect(localMoment(utc('2026-11-17T02:30:00'))).toEqual({ weekday: 1, minute: 23 * 60 + 30 });
    expect(localMoment(utc('2026-11-17T03:00:00'))).toEqual({ weekday: 2, minute: 0 });
  });
});

describe('RN-06 e RN-07: disponível agora (CA-04)', () => {
  it('item sem janela está sempre disponível', () => {
    expect(isOpenAt([], utc('2026-11-17T06:00:00'))).toBe(true);
  });

  it.each([
    ['2026-11-16T13:59:00', false],
    ['2026-11-16T14:00:00', true],
    ['2026-11-16T17:59:00', true],
    ['2026-11-16T18:00:00', false],
    ['2026-11-23T14:30:00', true],
    ['2026-11-17T14:30:00', false],
  ])('almoço de segunda às %s UTC: %s', (iso, open) => {
    expect(isOpenAt(lunchMonday, utc(iso))).toBe(open);
  });

  it('a virada do dia segue Belém, não UTC', () => {
    const lateMonday: TimeWindow[] = [{ weekday: 1, startMinute: 22 * 60, endMinute: 24 * 60 }];
    expect(isOpenAt(lateMonday, utc('2026-11-17T02:00:00'))).toBe(true);
    expect(isOpenAt(lateMonday, utc('2026-11-17T03:00:00'))).toBe(false);
  });
});

describe('RN-08: quando o item volta (CA-01)', () => {
  const week: TimeWindow[] = [
    { weekday: 1, startMinute: 660, endMinute: 900 },
    { weekday: 1, startMinute: 1080, endMinute: 1320 },
    { weekday: 5, startMinute: 1080, endMinute: 1380 },
  ];

  it('acha a próxima janela de hoje, de outro dia ou da semana que vem', () => {
    expect(nextOpening(week, utc('2026-11-16T12:00:00'))).toEqual({ daysAhead: 0, weekday: 1, minute: 660 });
    expect(nextOpening(week, utc('2026-11-16T19:00:00'))).toEqual({ daysAhead: 0, weekday: 1, minute: 1080 });
    expect(nextOpening(week, utc('2026-11-17T02:00:00'))).toEqual({ daysAhead: 4, weekday: 5, minute: 1080 });
    expect(nextOpening(lunchMonday, utc('2026-11-16T19:00:00'))).toEqual({ daysAhead: 7, weekday: 1, minute: 660 });
    expect(nextOpening([], utc('2026-11-16T19:00:00'))).toBeNull();
  });

  it('conta só inícios depois de agora e não depende da ordem das janelas', () => {
    expect(nextOpening(week, utc('2026-11-16T14:00:00'))).toEqual({ daysAhead: 0, weekday: 1, minute: 1080 });
    const unordered = [week[2], week[1], week[0]];
    expect(nextOpening(unordered, utc('2026-11-16T12:00:00'))).toEqual({ daysAhead: 0, weekday: 1, minute: 660 });
  });

  it('monta a mensagem com hoje ou com o nome do dia', () => {
    expect(unavailableMessage(week, utc('2026-11-16T19:00:00'))).toBe(
      'Este item não está disponível neste horário. Volta hoje às 18:00.',
    );
    expect(unavailableMessage(week, utc('2026-11-17T12:00:00'))).toBe(
      'Este item não está disponível neste horário. Volta sexta-feira às 18:00.',
    );
    expect(unavailableMessage([], utc('2026-11-17T12:00:00'))).toBe('Este item não está disponível neste horário.');
  });
});

describe('RF-02: descrição', () => {
  it('mostra o nome do dia e os horários', () => {
    expect(describeWindow({ weekday: 0, startMinute: 0, endMinute: 1440 })).toEqual({
      weekday: 0, day: 'domingo', start: '00:00', end: '24:00',
    });
  });
});
