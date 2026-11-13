import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Ingredient, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  CreateIngredientDto,
  SetRecipeDto,
  StockCountDto,
  StockEntryDto,
  StockLossDto,
  UpdateIngredientDto,
} from './stock.dto';
import {
  applyLoss,
  assertNoDuplicateIngredients,
  COUNT_MESSAGE,
  fromMilli,
  MINIMUM_MESSAGE,
  nonNegativeMilli,
  portionsAvailable,
  positiveMilli,
  stockAlerts,
  toMilli,
} from './stock-rules';

// Estoque de ingredientes (SPEC/2026-11-13-estoque-de-ingredientes.md).
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  // RF-01
  listIngredients() {
    return this.prisma.ingredient.findMany({ orderBy: { name: 'asc' } });
  }

  async getIngredient(id: number) {
    const ingredient = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) throw new NotFoundException('Ingrediente não encontrado.');
    return ingredient;
  }

  async createIngredient(dto: CreateIngredientDto) {
    const name = dto.name.trim();
    const minimum = nonNegativeMilli(dto.minimumQuantity ?? 0, MINIMUM_MESSAGE);
    await this.assertNameFree(name);
    return this.prisma.ingredient.create({ data: { name, unit: dto.unit, minimumQuantity: fromMilli(minimum) } });
  }

  async updateIngredient(id: number, dto: UpdateIngredientDto) {
    await this.getIngredient(id);
    const name = dto.name?.trim();
    if (name !== undefined) await this.assertNameFree(name, id);
    return this.prisma.ingredient.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.minimumQuantity !== undefined
          ? { minimumQuantity: fromMilli(nonNegativeMilli(dto.minimumQuantity, MINIMUM_MESSAGE)) }
          : {}),
      },
    });
  }

  // RN-09
  async deleteIngredient(id: number) {
    const ingredient = await this.getIngredient(id);
    const usedIn = await this.prisma.recipeItem.count({ where: { ingredientId: id } });
    if (usedIn) throw new BadRequestException(`Remova ${ingredient.name} das fichas técnicas antes de excluir.`);
    await this.prisma.ingredient.delete({ where: { id } });
    return { success: true };
  }

  // RF-02
  async registerEntry(id: number, dto: StockEntryDto) {
    const amount = positiveMilli(dto.quantity);
    return this.move(id, 'PURCHASE', (current) => current + amount, dto.note);
  }

  // RF-03 e RN-03
  async registerLoss(id: number, dto: StockLossDto) {
    const amount = positiveMilli(dto.quantity);
    return this.move(id, 'LOSS', (current, ingredient) => applyLoss(current, amount, ingredient), dto.note);
  }

  // RF-04 e RN-04: grava só a diferença; sem diferença, sem movimentação.
  async registerCount(id: number, dto: StockCountDto) {
    const counted = nonNegativeMilli(dto.countedQuantity, COUNT_MESSAGE);
    return this.move(id, 'ADJUSTMENT', () => counted, dto.note);
  }

  // RF-05
  async listMovements(id: number) {
    await this.getIngredient(id);
    return this.prisma.stockMovement.findMany({
      where: { ingredientId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  // RF-06
  async alerts() {
    const ingredients = await this.prisma.ingredient.findMany();
    const measured = ingredients.map((ingredient) => ({
      ingredient,
      name: ingredient.name,
      quantityMilli: toMilli(ingredient.quantity),
      minimumMilli: toMilli(ingredient.minimumQuantity),
    }));
    return stockAlerts<(typeof measured)[number]>(measured).map((alert) => alert.ingredient);
  }

  // RF-07 e RN-07
  async getRecipe(menuItemId: number) {
    const menuItem = await this.prisma.menuItem.findUnique({
      where: { id: menuItemId },
      include: { recipeItems: { include: { ingredient: true }, orderBy: { ingredient: { name: 'asc' } } } },
    });
    if (!menuItem) throw new NotFoundException('Item do cardápio não encontrado.');
    return {
      menuItemId,
      name: menuItem.name,
      items: menuItem.recipeItems.map((recipe) => ({
        ingredientId: recipe.ingredientId,
        name: recipe.ingredient.name,
        unit: recipe.ingredient.unit,
        quantity: recipe.quantity,
        inStock: recipe.ingredient.quantity,
      })),
      portionsAvailable: portionsAvailable(
        menuItem.recipeItems.map((recipe) => ({
          stockMilli: toMilli(recipe.ingredient.quantity),
          perPortionMilli: toMilli(recipe.quantity),
        })),
      ),
    };
  }

  // RF-07 e RN-06: substitui a ficha inteira; lista vazia apaga.
  async setRecipe(menuItemId: number, dto: SetRecipeDto) {
    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) throw new NotFoundException('Item do cardápio não encontrado.');

    const ids = dto.items.map((item) => item.ingredientId);
    const found = await this.prisma.ingredient.findMany({ where: { id: { in: ids } } });
    const byId = new Map(found.map((ingredient) => [ingredient.id, ingredient]));
    const missing = ids.find((id) => !byId.has(id));
    if (missing !== undefined) throw new NotFoundException(`Ingrediente ${missing} não encontrado.`);
    assertNoDuplicateIngredients(ids, (id) => byId.get(id)!.name);
    const quantities = dto.items.map((item) => fromMilli(positiveMilli(item.quantity)));

    await this.prisma.$transaction([
      this.prisma.recipeItem.deleteMany({ where: { menuItemId } }),
      this.prisma.recipeItem.createMany({
        data: dto.items.map((item, index) => ({ menuItemId, ingredientId: item.ingredientId, quantity: quantities[index] })),
      }),
    ]);
    return this.getRecipe(menuItemId);
  }

  // RN-01: nome único sem diferenciar maiúsculas.
  private async assertNameFree(name: string, ignoreId?: number) {
    const same = await this.prisma.ingredient.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...(ignoreId !== undefined ? { id: { not: ignoreId } } : {}) },
    });
    if (same) throw new BadRequestException(`Já existe um ingrediente chamado ${same.name}.`);
  }

  // RNF-02 e RNF-03: trava o ingrediente, grava a movimentação e a nova quantidade juntas.
  private move(
    id: number,
    type: StockMovementType,
    next: (currentMilli: number, ingredient: Ingredient) => number,
    note?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Ingredient" WHERE "id" = ${id} FOR UPDATE`;
      const ingredient = await tx.ingredient.findUnique({ where: { id } });
      if (!ingredient) throw new NotFoundException('Ingrediente não encontrado.');
      const current = toMilli(ingredient.quantity);
      const target = next(current, ingredient);
      if (target === current) return { ingredient, movement: null };
      const movement = await tx.stockMovement.create({
        data: { ingredientId: id, type, quantity: fromMilli(target - current), note: note?.trim() || null },
      });
      const updated = await tx.ingredient.update({ where: { id }, data: { quantity: fromMilli(target) } });
      return { ingredient: updated, movement };
    });
  }
}
