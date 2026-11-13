import { Prisma } from '@prisma/client';
import { fromMilli, requiredForSale, toMilli } from './stock-rules';

// RF-08 e RN-08: baixa dos ingredientes de uma comanda paga.
// Roda dentro da transação do fechamento de conta (AppService.closeOrder).
// Pode deixar o estoque negativo (RN-05).
export async function deductStockForSale(
  tx: Prisma.TransactionClient,
  order: { id: number; items: { menuItemId: number | null; quantity: number }[] },
): Promise<void> {
  const menuItemIds = [...new Set(order.items.flatMap((item) => (item.menuItemId === null ? [] : [item.menuItemId])))];
  if (!menuItemIds.length) return;

  const recipes = await tx.recipeItem.findMany({ where: { menuItemId: { in: menuItemIds } } });
  const required = requiredForSale(
    order.items,
    recipes.map((recipe) => ({
      menuItemId: recipe.menuItemId,
      ingredientId: recipe.ingredientId,
      perPortionMilli: toMilli(recipe.quantity),
    })),
  );

  // Ordem fixa por id para duas baixas simultâneas não travarem uma à outra.
  for (const [ingredientId, milli] of [...required].sort(([a], [b]) => a - b)) {
    await tx.stockMovement.create({
      data: { ingredientId, type: 'SALE', quantity: fromMilli(-milli), orderId: order.id },
    });
    await tx.ingredient.update({ where: { id: ingredientId }, data: { quantity: { decrement: fromMilli(milli) } } });
  }
}
