import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MenuCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AssignMenuCategoryDto, CreateMenuCategoryDto, ReorderMenuCategoriesDto, UpdateMenuCategoryDto } from './menu-categories.dto';
import { categoryKey, categoryName, deleteBlockedMessage, DUPLICATE_MESSAGE, fullOrder, importPlan } from './category-rules';

type Tx = Prisma.TransactionClient;
const NOT_FOUND = 'Categoria não encontrada.';

// Categorias do cardápio com ordem de exibição (SPEC/2026-11-16-categorias-do-cardapio.md).
@Injectable()
export class MenuCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // RF-02
  async list() {
    const categories = await this.prisma.menuCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { items: true } } },
    });
    return categories.map(({ _count, ...category }) => ({ ...category, itemCount: _count.items }));
  }

  // RF-01, RN-01 e RN-02
  async create(dto: CreateMenuCategoryDto) {
    const name = categoryName(dto.name);
    return this.unique(() =>
      this.prisma.$transaction(async (tx) => {
        await this.lock(tx);
        return tx.menuCategory.create({ data: { name, nameKey: categoryKey(name), sortOrder: await this.nextOrder(tx) } });
      }),
    );
  }

  // RF-03: renomear reescreve o texto dos itens ligados.
  async update(id: number, dto: UpdateMenuCategoryDto) {
    await this.require(id);
    if (dto.name === undefined) return this.require(id);
    const name = categoryName(dto.name);
    return this.unique(() =>
      this.prisma.$transaction(async (tx) => {
        const category = await tx.menuCategory.update({ where: { id }, data: { name, nameKey: categoryKey(name) } });
        await tx.menuItem.updateMany({ where: { categoryId: id }, data: { category: name } });
        return category;
      }),
    );
  }

  // RF-05 e RN-04
  async remove(id: number) {
    await this.require(id);
    const items = await this.prisma.menuItem.count({ where: { categoryId: id } });
    if (items) throw new BadRequestException(deleteBlockedMessage(items));
    await this.prisma.menuCategory.delete({ where: { id } });
    return { success: true };
  }

  // RF-04 e RN-03
  async reorder(dto: ReorderMenuCategoriesDto) {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx);
      const existing = await tx.menuCategory.findMany({ select: { id: true } });
      const ids = fullOrder(dto.ids, existing.map((category) => category.id));
      for (const [index, id] of ids.entries()) await tx.menuCategory.update({ where: { id }, data: { sortOrder: index } });
    });
    return this.list();
  }

  // RF-07 e RN-07
  async importFromItems() {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx);
      const loose = await tx.menuItem.findMany({ where: { categoryId: null }, select: { id: true, category: true } });
      const existing = await tx.menuCategory.findMany();
      const plan = importPlan(loose.map((item) => item.category), new Set(existing.map((category) => category.nameKey)));
      let order = await this.nextOrder(tx);
      const created: MenuCategory[] = [];
      for (const { key, name } of plan) created.push(await tx.menuCategory.create({ data: { name, nameKey: key, sortOrder: order++ } }));
      const byKey = new Map([...existing, ...created].map((category) => [category.nameKey, category]));
      let linkedItems = 0;
      for (const item of loose) {
        const category = byKey.get(categoryKey(item.category));
        if (!category) continue;
        await tx.menuItem.update({ where: { id: item.id }, data: { categoryId: category.id, category: category.name } });
        linkedItems += 1;
      }
      return { created: created.map((category) => category.name), linkedItems };
    });
  }

  // RF-06 e RN-06
  async assignItem(menuItemId: number, dto: AssignMenuCategoryDto) {
    const item = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!item) throw new NotFoundException('Item do cardápio não encontrado.');
    if (dto.categoryId === null) return this.prisma.menuItem.update({ where: { id: menuItemId }, data: { categoryId: null } });
    const category = await this.require(dto.categoryId);
    return this.prisma.menuItem.update({ where: { id: menuItemId }, data: { categoryId: category.id, category: category.name } });
  }

  private async require(id: number) {
    const category = await this.prisma.menuCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException(NOT_FOUND);
    return category;
  }

  // Criar, reordenar e importar não correm ao mesmo tempo (RNF-02).
  private async lock(tx: Tx) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('menu-categories'))`;
  }

  private async nextOrder(tx: Tx) {
    const last = await tx.menuCategory.aggregate({ _max: { sortOrder: true } });
    return (last._max.sortOrder ?? -1) + 1;
  }

  // RNF-01
  private async unique<T>(save: () => Promise<T>) {
    try {
      return await save();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(DUPLICATE_MESSAGE);
      throw error;
    }
  }
}
