import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_ZONE, NOT_FOUND_MESSAGE } from './zone-rules';

// Acesso às zonas usado também pelo cadastro de mesas (SPEC/2026-11-17-zonas-do-salao.md).
type Db = Pick<Prisma.TransactionClient, 'zone'>;

// RF-03 e RN-04: a primeira zona da ordem; se não houver nenhuma, cria a zona padrão.
export async function defaultZoneId(db: Db): Promise<number> {
  const first = await db.zone.findFirst({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  if (first) return first.id;
  const created = await db.zone.upsert({ where: { name: DEFAULT_ZONE }, update: {}, create: { name: DEFAULT_ZONE, sortOrder: 1 } });
  return created.id;
}

// RN-05
export async function existingZoneId(db: Db, zoneId: number): Promise<number> {
  const zone = await db.zone.findUnique({ where: { id: zoneId } });
  if (!zone) throw new NotFoundException(NOT_FOUND_MESSAGE);
  return zone.id;
}

export function resolveZoneId(db: Db, zoneId: number | undefined): Promise<number> {
  return zoneId === undefined ? defaultZoneId(db) : existingZoneId(db, zoneId);
}
