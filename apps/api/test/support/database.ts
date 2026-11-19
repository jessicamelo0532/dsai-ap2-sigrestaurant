import { ExpensesController } from '../../src/expenses/expenses.controller';
import { ExpensesService } from '../../src/expenses/expenses.service';
import { MenuService } from '../../src/menu/menu.service';
import { OrdersService } from '../../src/orders/orders.service';
import { PrismaService } from '../../src/prisma.service';
import { ReportsController } from '../../src/reports/reports.controller';
import { ReportsService } from '../../src/reports/reports.service';
import { TablesService } from '../../src/tables/tables.service';
import { assertTestDatabase } from './database-guard';

assertTestDatabase(process.env.DATABASE_URL);

export const prisma = new PrismaService();
const expenses = new ExpensesService(prisma);
const menu = new MenuService(prisma);
const orders = new OrdersService(prisma);
const reports = new ReportsService(prisma);
const tables = new TablesService(prisma);
const expensesController = new ExpensesController(expenses);
const reportsController = new ReportsController(reports);
export const service = {
  listTables: tables.listTables.bind(tables),
  createTable: tables.createTable.bind(tables),
  deleteTable: tables.deleteTable.bind(tables),
  listMenu: menu.listMenu.bind(menu),
  getMenuItem: menu.getMenuItem.bind(menu),
  createMenuItem: menu.createMenuItem.bind(menu),
  updateMenuItem: menu.updateMenuItem.bind(menu),
  deleteMenuItem: menu.deleteMenuItem.bind(menu),
  addOrderItem: orders.addOrderItem.bind(orders),
  updateOrderItem: orders.updateOrderItem.bind(orders),
  removeOrderItem: orders.removeOrderItem.bind(orders),
  closeOrder: orders.closeOrder.bind(orders),
  cancelOrder: orders.cancelOrder.bind(orders),
  listOpenOrders: orders.listOpenOrders.bind(orders),
  getOrder: orders.getOrder.bind(orders),
  createExpense: expenses.createExpense.bind(expenses),
  listExpenses: expenses.listExpenses.bind(expenses),
  updateExpense: expenses.updateExpense.bind(expenses),
  deleteExpense: expenses.deleteExpense.bind(expenses),
  report: reports.report.bind(reports),
};
export const controller = {
  report: reportsController.report.bind(reportsController),
  expenses: expensesController.expenses.bind(expensesController),
  createExpense: expensesController.createExpense.bind(expensesController),
  updateExpense: expensesController.updateExpense.bind(expensesController),
  deleteExpense: expensesController.deleteExpense.bind(expensesController),
};

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
