import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateMenuItemDto, UpdateMenuItemDto } from '../dto';
import { isOpenAt } from '../menu-availability/availability-rules';
import { Clock, MENU_CLOCK } from '../menu-availability/menu-clock';
import { resolveCategory } from '../menu-categories/category-link';
import { compareMenu } from '../menu-categories/category-rules';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MenuService {
  private readonly now: Clock;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(MENU_CLOCK) clock?: Clock,
  ) {
    this.now = clock ?? (() => new Date());
  }

  async listMenu(includeUnavailable = false) {
    const items = await this.prisma.menuItem.findMany({
      where: includeUnavailable ? undefined : { available: true },
      include: { availability: true, menuCategory: { select: { sortOrder: true } } },
    });
    const now = this.now();
    return items
      // RF-03 da SPEC/2026-11-16-cardapio-por-horario.md: fora da janela, o item some da lista.
      .filter((item) => includeUnavailable || isOpenAt(item.availability, now))
      // RF-08 da SPEC/2026-11-16-categorias-do-cardapio.md: ordem das categorias cadastradas.
      .sort((a, b) => compareMenu(
        { name: a.name, category: a.category, categoryOrder: a.menuCategory?.sortOrder ?? null },
        { name: b.name, category: b.category, categoryOrder: b.menuCategory?.sortOrder ?? null },
      ))
      .map(({ availability: _windows, menuCategory: _category, ...item }) => item);
  }

  getMenuItem(id: number) {
    return this.requireMenuItem(id);
  }

  async createMenuItem(dto: CreateMenuItemDto) {
    // RN-05 da SPEC/2026-11-16-categorias-do-cardapio.md: o texto liga o item à categoria cadastrada.
    const link = await resolveCategory(this.prisma, dto.category || 'Geral');
    return this.prisma.menuItem.create({ data: { ...dto, price: new Prisma.Decimal(dto.price), ...link } });
  }

  async updateMenuItem(id: number, dto: UpdateMenuItemDto) {
    await this.requireMenuItem(id);
    return this.prisma.menuItem.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
        ...(dto.category !== undefined ? await resolveCategory(this.prisma, dto.category || 'Geral') : {}), // RN-05 da SPEC/2026-11-16-categorias-do-cardapio.md
      },
    });
  }

  async deleteMenuItem(id: number) {
    await this.requireMenuItem(id);
    await this.prisma.menuItem.delete({ where: { id } });
    return { success: true };
  }

  private async requireMenuItem(id: number) {
    const item = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item do cardápio não encontrado.');
    return item;
  }
}
