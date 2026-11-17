import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { assertDeletable, duplicateMessage, nextSortOrder, NOT_FOUND_MESSAGE, zoneName } from './zone-rules';
import { existingZoneId } from './zone-store';
import { MoveTableDto, ZoneNameDto } from './zones.dto';

// Zonas do salão (SPEC/2026-11-17-zonas-do-salao.md).
@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  // RF-01 e RN-06
  async list() {
    const zones = await this.prisma.zone.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { tables: true } } },
    });
    return zones.map(({ _count, ...zone }) => ({ ...zone, tableCount: _count.tables }));
  }

  // RF-02, RN-01, RN-02 e RN-06
  async create(dto: ZoneNameDto) {
    const name = zoneName(dto.name);
    return this.prisma.$transaction(async (tx) => {
      await this.assertNameFree(tx, name);
      const orders = await tx.zone.findMany({ select: { sortOrder: true } });
      return tx.zone.create({ data: { name, sortOrder: nextSortOrder(orders.map((zone) => zone.sortOrder)) } });
    });
  }

  async rename(id: number, dto: ZoneNameDto) {
    const name = zoneName(dto.name);
    await this.get(id);
    await this.assertNameFree(this.prisma, name, id);
    return this.prisma.zone.update({ where: { id }, data: { name } });
  }

  // RN-03
  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const zone = await tx.zone.findUnique({ where: { id }, include: { _count: { select: { tables: true } } } });
      if (!zone) throw new NotFoundException(NOT_FOUND_MESSAGE);
      assertDeletable(zone._count.tables, await tx.zone.count());
      await tx.zone.delete({ where: { id } });
      return { success: true };
    });
  }

  // RF-04 e RN-05
  async moveTable(tableId: number, dto: MoveTableDto) {
    const table = await this.prisma.diningTable.findUnique({ where: { id: tableId } });
    if (!table) throw new NotFoundException('Mesa não encontrada.');
    const zoneId = await existingZoneId(this.prisma, dto.zoneId);
    return this.prisma.diningTable.update({ where: { id: tableId }, data: { zoneId } });
  }

  private async get(id: number) {
    const zone = await this.prisma.zone.findUnique({ where: { id } });
    if (!zone) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return zone;
  }

  // RN-02: sem diferenciar maiúsculas e minúsculas.
  private async assertNameFree(db: Pick<PrismaService, 'zone'>, name: string, ignoreId?: number) {
    const same = await db.zone.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...(ignoreId !== undefined ? { id: { not: ignoreId } } : {}) },
    });
    if (same) throw new BadRequestException(duplicateMessage(same.name));
  }
}
