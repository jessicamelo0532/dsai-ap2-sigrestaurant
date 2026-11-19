import { AppController } from '../../src/app.controller';
import { AppService } from '../../src/app.service';
import { OrdersService } from '../../src/orders/orders.service';
import { PrismaService } from '../../src/prisma.service';
import { assertTestDatabase } from './database-guard';

assertTestDatabase(process.env.DATABASE_URL);

export const prisma = new PrismaService();
const app = new AppService(prisma);
const orders = new OrdersService(prisma);
export const service = {
  listTables: app.listTables.bind(app),
  createTable: app.createTable.bind(app),
  deleteTable: app.deleteTable.bind(app),
  listMenu: app.listMenu.bind(app),
  getMenuItem: app.getMenuItem.bind(app),
  createMenuItem: app.createMenuItem.bind(app),
  updateMenuItem: app.updateMenuItem.bind(app),
  deleteMenuItem: app.deleteMenuItem.bind(app),
  addOrderItem: orders.addOrderItem.bind(orders),
  updateOrderItem: orders.updateOrderItem.bind(orders),
  removeOrderItem: orders.removeOrderItem.bind(orders),
  closeOrder: orders.closeOrder.bind(orders),
  cancelOrder: orders.cancelOrder.bind(orders),
  listOpenOrders: orders.listOpenOrders.bind(orders),
  getOrder: orders.getOrder.bind(orders),
  createExpense: app.createExpense.bind(app),
  listExpenses: app.listExpenses.bind(app),
  updateExpense: app.updateExpense.bind(app),
  deleteExpense: app.deleteExpense.bind(app),
  report: app.report.bind(app),
};
export const controller = new AppController(app, orders);

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "OpeningHour", "Receivable", "SalesGoal", "OrderItemAddon", "MenuVariant", "MenuAddon", "MenuCategory", "MenuAvailability", "LoyaltyEntry", "LoyaltySettings", "KitchenPriorityChange", "KitchenTicket", "OrderEvent", "Waiter", "CashMovement", "CashSession", "MonthlyClosing", "PurchaseItem", "Purchase", "Supplier", "StockMovement", "RecipeItem", "Ingredient", "Reservation", "OrderItem", "Order", "MenuItem", "DiningTable", "Zone", "Expense", "Customer" RESTART IDENTITY CASCADE',
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
