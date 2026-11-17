import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { describeWindow, isOpenAt, parseWindows, TimeWindow } from './availability-rules';
import { Clock, MENU_CLOCK } from './menu-clock';
import { SetAvailabilityDto } from './menu-availability.dto';

const windowOrder = [{ weekday: 'asc' as const }, { startMinute: 'asc' as const }];

// Janelas de horário do item do cardápio (SPEC/2026-11-16-cardapio-por-horario.md).
@Injectable()
export class MenuAvailabilityService {
  private readonly now: Clock;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(MENU_CLOCK) clock?: Clock,
  ) {
    this.now = clock ?? (() => new Date());
  }

  // RF-02
  async get(menuItemId: number) {
    const item = await this.prisma.menuItem.findUnique({ where: { id: menuItemId }, include: { availability: { orderBy: windowOrder } } });
    if (!item) throw new NotFoundException('Item do cardápio não encontrado.');
    return this.describe(item.id, item.available, item.availability);
  }

  // RF-01 e RNF-01: troca todas as janelas de uma vez.
  async replace(menuItemId: number, dto: SetAvailabilityDto) {
    const windows = parseWindows(dto.windows);
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.findUnique({ where: { id: menuItemId } });
      if (!item) throw new NotFoundException('Item do cardápio não encontrado.');
      await tx.menuAvailability.deleteMany({ where: { menuItemId } });
      if (windows.length) await tx.menuAvailability.createMany({ data: windows.map((w) => ({ menuItemId, ...w })) });
    });
    return this.get(menuItemId);
  }

  private describe(menuItemId: number, available: boolean, windows: TimeWindow[]) {
    return {
      menuItemId,
      alwaysAvailable: windows.length === 0,
      availableNow: available && isOpenAt(windows, this.now()),
      windows: windows.map(describeWindow),
    };
  }
}
