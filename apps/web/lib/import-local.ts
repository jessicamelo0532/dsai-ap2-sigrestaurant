import { apiRequest } from './api-client';
import { readLocalData } from './local-store';
import type { Expense, MenuItem, Table } from './types';

export type ImportReport = {
  tablesCreated: number;
  menuItemsCreated: number;
  expensesCreated: number;
  orderLinesSent: number;
  skipped: number;
};

function json(body: unknown): RequestInit {
  return { method: 'POST', body: JSON.stringify(body) };
}

/**
 * Leva os dados que estão no navegador para a API, por ação explícita do usuário.
 * Não apaga nem altera o que está no navegador; apenas envia.
 */
export async function importLocalData(baseUrl: string): Promise<ImportReport> {
  const local = readLocalData();
  const report: ImportReport = {
    tablesCreated: 0,
    menuItemsCreated: 0,
    expensesCreated: 0,
    orderLinesSent: 0,
    skipped: 0,
  };

  const serverTables = await apiRequest<Table[]>(baseUrl, '/tables');
  const serverMenu = await apiRequest<MenuItem[]>(baseUrl, '/menu-items?all=true');

  const tableIds = new Map<number, number>();
  for (const table of local.tables) {
    const existing = serverTables.find((entry) => entry.number === table.number);
    if (existing) {
      tableIds.set(table.id, existing.id);
      continue;
    }
    const created = await apiRequest<Table>(baseUrl, '/tables', json({ number: table.number, capacity: table.capacity }));
    tableIds.set(table.id, created.id);
    report.tablesCreated += 1;
  }

  const menuIds = new Map<number, number>();
  for (const item of local.menu) {
    const existing = serverMenu.find((entry) => entry.name === item.name);
    if (existing) {
      menuIds.set(item.id, existing.id);
      continue;
    }
    const created = await apiRequest<MenuItem>(baseUrl, '/menu-items', json({
      name: item.name,
      description: item.description ?? undefined,
      category: item.category || 'Geral',
      price: Number(item.price),
      available: item.available,
    }));
    menuIds.set(item.id, created.id);
    report.menuItemsCreated += 1;
  }

  for (const expense of local.expenses as Expense[]) {
    await apiRequest<Expense>(baseUrl, '/expenses', json({
      description: expense.description,
      amount: Number(expense.amount),
      incurredAt: expense.incurredAt,
    }));
    report.expensesCreated += 1;
  }

  for (const order of local.orders) {
    if (order.status !== 'OPEN') continue;
    const tableId = order.tableId === null ? undefined : tableIds.get(order.tableId);
    if (!tableId) {
      report.skipped += order.items.length;
      continue;
    }
    for (const line of order.items) {
      const menuItemId = line.menuItemId === null ? undefined : menuIds.get(line.menuItemId);
      if (!menuItemId) {
        report.skipped += 1;
        continue;
      }
      await apiRequest(baseUrl, `/tables/${tableId}/items`, json({ menuItemId, quantity: line.quantity }));
      report.orderLinesSent += 1;
    }
  }

  return report;
}

export function hasLocalData(): boolean {
  const local = readLocalData();
  return local.tables.length > 0 || local.menu.length > 0 || local.expenses.length > 0 || local.orders.length > 0;
}
