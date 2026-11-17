import { Prisma } from '@prisma/client';
import { categoryKey } from './category-rules';

// RN-05: o texto da categoria liga o item à categoria cadastrada com o mesmo nome (SPEC/2026-11-16-categorias-do-cardapio.md).
export async function resolveCategory(db: Pick<Prisma.TransactionClient, 'menuCategory'>, text: string) {
  const category = await db.menuCategory.findUnique({ where: { nameKey: categoryKey(text) } });
  return category ? { categoryId: category.id, category: category.name } : { categoryId: null, category: text };
}
