import { describe, expect, it } from 'vitest';
import { assertWithinOpeningHours, fitsOpeningHours, outsideHoursMessage } from '../src/opening-hours/opening-rules';

// SPEC/2026-11-17-horario-de-funcionamento.md (T-01). Horário local de Belém (UTC−3), como no cardápio por horário.
// 20/11/2026 é sexta-feira; 21/11/2026 é sábado.
const friday = [
  { weekday: 5, startMinute: 11 * 60, endMinute: 15 * 60 },
  { weekday: 5, startMinute: 18 * 60, endMinute: 23 * 60 },
];
const local = (iso: string) => new Date(`${iso}-03:00`);
const plus = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

describe('RN-02: a reserva cabe inteira numa janela do dia', () => {
  it('cabe dentro da janela, inclusive terminando no fim', () => {
    const start = local('2026-11-20T19:00:00');
    expect(fitsOpeningHours(friday, start, plus(start, 120))).toBe(true);
    const late = local('2026-11-20T21:00:00');
    expect(fitsOpeningHours(friday, late, plus(late, 120))).toBe(true);
  });

  it('não cabe passando do fim, começando antes ou atravessando o intervalo', () => {
    const late = local('2026-11-20T22:00:00');
    expect(fitsOpeningHours(friday, late, plus(late, 120))).toBe(false);
    const early = local('2026-11-20T10:30:00');
    expect(fitsOpeningHours(friday, early, plus(early, 60))).toBe(false);
    const between = local('2026-11-20T14:00:00');
    expect(fitsOpeningHours(friday, between, plus(between, 300))).toBe(false);
  });

  it('não atravessa a meia-noite', () => {
    const allDay = [{ weekday: 5, startMinute: 0, endMinute: 24 * 60 }];
    const late = local('2026-11-20T23:00:00');
    expect(fitsOpeningHours(allDay, late, plus(late, 60))).toBe(true);
    expect(fitsOpeningHours(allDay, late, plus(late, 90))).toBe(false);
  });

  it('RN-04: sem horário cadastrado, qualquer horário cabe', () => {
    const start = local('2026-11-21T03:00:00');
    expect(fitsOpeningHours([], start, plus(start, 360))).toBe(true);
  });
});

describe('RN-03: mensagens', () => {
  it('lista as janelas do dia', () => {
    expect(outsideHoursMessage(friday, local('2026-11-20T22:00:00')))
      .toBe('A reserva fica fora do horário de funcionamento de sexta-feira: das 11:00 às 15:00 e das 18:00 às 23:00.');
  });

  it('dia sem janela', () => {
    expect(outsideHoursMessage(friday, local('2026-11-21T19:00:00'))).toBe('A casa não abre sábado.');
  });

  it('assert recusa só o que não cabe', () => {
    const ok = local('2026-11-20T19:00:00');
    expect(() => assertWithinOpeningHours(friday, ok, plus(ok, 60))).not.toThrow();
    const saturday = local('2026-11-21T19:00:00');
    expect(() => assertWithinOpeningHours(friday, saturday, plus(saturday, 60))).toThrow('A casa não abre sábado.');
  });
});
