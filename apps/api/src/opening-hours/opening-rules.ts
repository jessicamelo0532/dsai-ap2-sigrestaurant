import { BadRequestException } from '@nestjs/common';
import { formatTime, localMoment, TimeWindow } from '../menu-availability/availability-rules';
import { WEEKDAYS } from '../sales-reports/sales-rules';

// Regras puras do horário de funcionamento (SPEC/2026-11-17-horario-de-funcionamento.md).
// As janelas usam as mesmas regras e o mesmo fuso do cardápio por horário (RNF-01).

const DAY_MINUTES = 24 * 60;

// RN-02 (P-1): início e fim, no horário local, dentro de uma mesma janela do dia do início.
// RN-04 (P-2): sem janelas, qualquer horário cabe.
export function fitsOpeningHours(windows: readonly TimeWindow[], startsAt: Date, endsAt: Date): boolean {
  if (!windows.length) return true;
  const start = localMoment(startsAt);
  const minutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  const endMinute = start.minute + minutes;
  if (endMinute > DAY_MINUTES) return false;
  return windows.some((w) => w.weekday === start.weekday && w.startMinute <= start.minute && endMinute <= w.endMinute);
}

// RN-03
export function outsideHoursMessage(windows: readonly TimeWindow[], startsAt: Date): string {
  const { weekday } = localMoment(startsAt);
  const day = windows.filter((w) => w.weekday === weekday).sort((a, b) => a.startMinute - b.startMinute);
  if (!day.length) return `A casa não abre ${WEEKDAYS[weekday]}.`;
  const ranges = day.map((w) => `das ${formatTime(w.startMinute)} às ${formatTime(w.endMinute)}`).join(' e ');
  return `A reserva fica fora do horário de funcionamento de ${WEEKDAYS[weekday]}: ${ranges}.`;
}

export function assertWithinOpeningHours(windows: readonly TimeWindow[], startsAt: Date, endsAt: Date): void {
  if (!fitsOpeningHours(windows, startsAt, endsAt)) throw new BadRequestException(outsideHoursMessage(windows, startsAt));
}
