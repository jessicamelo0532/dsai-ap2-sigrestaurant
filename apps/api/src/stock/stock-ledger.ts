import { Prisma, StockMovementType } from '@prisma/client';
import { fromMilli } from './stock-rules';

// Grava uma movimentação e soma a diferença ao saldo do ingrediente, na transação recebida.
// Usada pela baixa de venda e pelas compras (RNF-02 das SPECs de estoque e de compras).
export async function recordMovement(
  tx: Prisma.TransactionClient,
  movement: {
    ingredientId: number;
    type: StockMovementType;
    deltaMilli: number;
    note?: string | null;
    orderId?: number;
    purchaseId?: number;
  },
): Promise<void> {
  const quantity = fromMilli(movement.deltaMilli);
  await tx.stockMovement.create({
    data: {
      ingredientId: movement.ingredientId,
      type: movement.type,
      quantity,
      note: movement.note ?? null,
      orderId: movement.orderId,
      purchaseId: movement.purchaseId,
    },
  });
  await tx.ingredient.update({ where: { id: movement.ingredientId }, data: { quantity: { increment: quantity } } });
}
