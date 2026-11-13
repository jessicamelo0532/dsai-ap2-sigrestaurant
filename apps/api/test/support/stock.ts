import { StockController } from '../../src/stock/stock.controller';
import { StockService } from '../../src/stock/stock.service';
import { StockUnit } from '../../src/stock/stock-rules';
import { prisma } from './database';

export const stock = new StockService(prisma);
export const stockController = new StockController(stock);

// Cria o ingrediente e, se pedido, registra uma entrada inicial.
export async function ingredientWith(name: string, quantity = 0, unit: StockUnit = 'KG', minimumQuantity = 0) {
  const ingredient = await stock.createIngredient({ name, unit, minimumQuantity });
  if (quantity > 0) await stock.registerEntry(ingredient.id, { quantity });
  return ingredient;
}

export async function quantityOf(id: number) {
  return (await stock.getIngredient(id)).quantity.toFixed(3);
}
