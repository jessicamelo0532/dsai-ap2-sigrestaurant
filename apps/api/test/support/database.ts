import { AppController } from '../../src/app.controller';
import { AppService } from '../../src/app.service';
import { PrismaService } from '../../src/prisma.service';
import { assertTestDatabase } from './database-guard';

assertTestDatabase(process.env.DATABASE_URL);

export const prisma = new PrismaService();
export const service = new AppService(prisma);
export const controller = new AppController(service);

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "PurchaseItem", "Purchase", "Supplier", "StockMovement", "RecipeItem", "Ingredient", "Reservation", "OrderItem", "Order", "MenuItem", "DiningTable", "Expense" RESTART IDENTITY CASCADE',
  );
}

export function createMenuItem(overrides: Partial<{ name: string; category: string; price: number; available: boolean }> = {}) {
  return service.createMenuItem({ name: 'Açaí com peixe', category: 'Pratos principais', price: 45.5, ...overrides });
}

export function createTable(number: number, capacity = 4) {
  return service.createTable({ number, capacity });
}

// Abre uma comanda na mesa com um item e devolve a comanda.
export async function openOrder(tableNumber: number, quantity = 1, price = 45.5) {
  const table = await createTable(tableNumber);
  const item = await createMenuItem({ name: `Prato da mesa ${tableNumber}`, price });
  const order = await service.addOrderItem(table.id, { menuItemId: item.id, quantity });
  return { table, item, order: order! };
}
