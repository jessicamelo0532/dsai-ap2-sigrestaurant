import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDate, storeRequest } from './store';
import type { MenuItem, Order, Table } from './store';
import type { SalesReport } from './sales-report';

const STORAGE_KEY = 'mesa-clara.data.v1';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, String(value)); },
    removeItem: (key: string) => { map.delete(key); },
    clear: () => { map.clear(); },
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() { return map.size; },
  };
}

async function createTable(number: number): Promise<Table> {
  return storeRequest<Table>('/tables', { method: 'POST', body: JSON.stringify({ number, capacity: 4 }) });
}

async function createItem(name: string, price: number, category = 'Pratos'): Promise<MenuItem> {
  return storeRequest<MenuItem>('/menu-items', { method: 'POST', body: JSON.stringify({ name, price, category }) });
}

async function openOrder(tableId: number, itemId: number, quantity = 1): Promise<Order> {
  return storeRequest<Order>(`/tables/${tableId}/items`, { method: 'POST', body: JSON.stringify({ menuItemId: itemId, quantity }) });
}

async function closeOrder(id: number, paymentMethod = 'PIX'): Promise<Order> {
  return storeRequest<Order>(`/orders/${id}/close`, { method: 'POST', body: JSON.stringify({ paymentMethod }) });
}

async function sales(from = localDate(new Date()), to = from, limit?: number): Promise<SalesReport> {
  const query = `from=${from}&to=${to}${limit ? `&limit=${limit}` : ''}`;
  return storeRequest<SalesReport>(`/reports/sales?${query}`);
}

// SPEC/2026-11-25-tela-de-relatorios-de-vendas.md (RN-10, CA-06).
describe('relatório de vendas no modo navegador', () => {
  beforeEach(() => {
    const storage = memoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
    storage.setItem(STORAGE_KEY, JSON.stringify({ tables: [], menu: [], orders: [], expenses: [] }));
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('calcula o mesmo relatório a partir das comandas pagas', async () => {
    const table = await createTable(201);
    const pizza = await createItem('Pizza', 30);
    const juice = await createItem('Suco', 9, 'Bebidas');
    const order = await openOrder(table.id, pizza.id, 2);
    await openOrder(table.id, juice.id, 1);
    await closeOrder(order.id, 'PIX');

    const report = await sales();
    expect(report.paidOrders).toBe(1);
    expect(report.revenue).toBe('69.00');
    expect(report.itemsSold).toBe(3);
    expect(report.averageTicket).toBe('69.00');
    expect(report.topByQuantity.map((item) => [item.name, item.quantity, item.revenue])).toEqual([
      ['Pizza', 2, '60.00'],
      ['Suco', 1, '9.00'],
    ]);
    expect(report.byCategory.map((entry) => [entry.category, entry.revenue])).toEqual([
      ['Pratos', '60.00'],
      ['Bebidas', '9.00'],
    ]);
    expect(report.byPayment.find((entry) => entry.method === 'PIX')).toMatchObject({ orders: 1, revenue: '69.00', share: 100 });
    expect(report.byHour.reduce((sum, entry) => sum + Math.round(Number(entry.revenue) * 100), 0)).toBe(6900);
  });

  it('exclui comandas abertas e canceladas e respeita o limite', async () => {
    const table = await createTable(202);
    const a = await createItem('A', 10);
    const b = await createItem('B', 20);
    const closed = await openOrder(table.id, a.id, 2);
    await openOrder(table.id, b.id, 1);
    await closeOrder(closed.id);

    const table2 = await createTable(203);
    const open = await openOrder(table2.id, b.id, 5);
    await storeRequest(`/orders/${open.id}/cancel`, { method: 'POST' });

    const report = await sales(localDate(new Date()), localDate(new Date()), 1);
    expect(report.paidOrders).toBe(1);
    expect(report.revenue).toBe('40.00');
    expect(report.topByQuantity).toHaveLength(1);
  });

  it('usa a categoria de fallback quando o item saiu do cardápio', async () => {
    const table = await createTable(204);
    const item = await createItem('Antigo', 15, 'Pratos');
    const order = await openOrder(table.id, item.id, 1);
    await closeOrder(order.id);
    await storeRequest(`/menu-items/${item.id}`, { method: 'DELETE' });

    const report = await sales();
    expect(report.byCategory[0].category).toBe('Item removido do cardápio');
    expect(report.topByQuantity[0].category).toBe('Item removido do cardápio');
  });

  it('recusa período e limite inválidos sem chamar a rede', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(storeRequest('/reports/sales?from=2026-11-30&to=2026-11-01')).rejects.toThrow(
      'A data inicial deve ser anterior ou igual à data final.',
    );
    await expect(storeRequest('/reports/sales?from=2026-11-01&to=2026-11-02&limit=51')).rejects.toThrow(
      'Informe um limite de 1 a 50 itens.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
