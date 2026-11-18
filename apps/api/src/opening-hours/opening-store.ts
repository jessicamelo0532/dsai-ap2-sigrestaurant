import { Prisma } from '@prisma/client';
import { TimeWindow } from '../menu-availability/availability-rules';

// Leitura das janelas, usada pelo cadastro e pelas reservas (SPEC/2026-11-17-horario-de-funcionamento.md).
export async function loadOpeningHours(db: Pick<Prisma.TransactionClient, 'openingHour'>): Promise<TimeWindow[]> {
  const rows = await db.openingHour.findMany({ orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] });
  return rows.map(({ weekday, startMinute, endMinute }) => ({ weekday, startMinute, endMinute }));
}
