import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDate, money, orderTotal, storeRequest } from './store';
import type { MenuItem, Order, Report, Table } from './store';

const STORAGE_KEY = 'mesa-clara.data.v1';

type MemoryStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  key: (index: number) => string | null;
  readonly length: number;
};

function memoryStorage(): MemoryStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
}

function dayAt(deltaDays: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + deltaDays);
  date.setHours(12, 0, 0, 0);
  return date;
}

async function createTable(number: number, capacity = 4): Promise<Table> {
  return storeRequest<Table>('/tables', {
    method: 'POST',
    body: JSON.stringify({ number, capacity }),
  });
}

async function createMenuItem(name: string, price: number): Promise<MenuItem> {
  return storeRequest<MenuItem>('/menu-items', {
    method: 'POST',
    body: JSON.stringify({ name, price, category: 'Teste' }),
  });
}

async function addItem(tableId: number, menuItemId: number, quantity: number): Promise<Order> {
  return storeRequest<Order>(`/tables/${tableId}/items`, {
    method: 'POST',
    body: JSON.stringify({ menuItemId, quantity }),
  });
}

async function closeOrder(orderId: number): Promise<Order> {
  return storeRequest<Order>(`/orders/${orderId}/close`, {
    method: 'POST',
    body: JSON.stringify({ paymentMethod: 'PIX' }),
  });
}

async function report(from?: string, to?: string): Promise<Report> {
  const query = from !== undefined && to !== undefined ? `?from=${from}&to=${to}` : '';
  return storeRequest<Report>(`/reports/financial${query}`);
}

describe('store — regras de negócio (SPEC/2026-11-10-infraestrutura-de-testes)', () => {
  beforeEach(() => {
    const storage = memoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
    storage.setItem(STORAGE_KEY, JSON.stringify({ tables: [], menu: [], orders: [], expenses: [] }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('T-01: total da comanda em centavos exatos com preço fracionário e receita no relatório', async () => {
    const table = await createTable(91);
    const item = await createMenuItem('Item fracionário', 0.29);
    await addItem(table.id, item.id, 3);

    const tables = await storeRequest<Table[]>('/tables');
    const order = tables.find((entry) => entry.id === table.id)?.order;
    expect(order).not.toBeNull();
    expect(orderTotal(order!)).toBeCloseTo(0.87, 10);
    expect(money(orderTotal(order!)).replace(/\u00A0/g, ' ')).toBe('R$ 0,87');

    await closeOrder(order!.id);
    const today = localDate(new Date());
    const rep = await report(today, today);
    expect(rep.revenue).toBe('0.87');
    expect(rep.paidOrders).toBe(1);
  });

  it('T-02: fechar a comanda duas vezes não duplica receita', async () => {
    const table = await createTable(92);
    const item = await createMenuItem('Prato fechado', 10);
    const order = await addItem(table.id, item.id, 1);

    await closeOrder(order.id);
    await expect(closeOrder(order.id)).rejects.toThrow('Esta comanda já foi fechada.');

    const today = localDate(new Date());
    const rep = await report(today, today);
    expect(rep.paidOrders).toBe(1);
    expect(rep.revenue).toBe('10.00');
  });

  it('T-03: editar e remover item do cardápio preserva o snapshot das linhas antigas da comanda', async () => {
    const table = await createTable(93);
    const item = await createMenuItem('Prato Antigo', 10);
    await addItem(table.id, item.id, 1);

    await storeRequest(`/menu-items/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Prato Novo', price: 55.5 }),
    });
    await storeRequest(`/menu-items/${item.id}`, { method: 'DELETE' });

    const tables = await storeRequest<Table[]>('/tables');
    const order = tables.find((entry) => entry.id === table.id)?.order;
    expect(order).not.toBeNull();
    expect(order!.items).toHaveLength(1);
    expect(order!.items[0].nameSnapshot).toBe('Prato Antigo');
    expect(order!.items[0].unitPrice).toBe('10.00');
    expect(orderTotal(order!)).toBeCloseTo(10, 10);
  });

  it('T-04: mesa com comanda aberta não pode ser removida; após liberar, a remoção funciona', async () => {
    const table = await createTable(94);
    const item = await createMenuItem('Item ocupado', 5);
    const order = await addItem(table.id, item.id, 1);

    await expect(
      storeRequest(`/tables/${table.id}`, { method: 'DELETE' })
    ).rejects.toThrow('Feche a comanda antes de remover esta mesa.');

    let tables = await storeRequest<Table[]>('/tables');
    expect(tables.some((entry) => entry.id === table.id)).toBe(true);

    await closeOrder(order.id);
    const deleted = await storeRequest<{ success: boolean }>(`/tables/${table.id}`, {
      method: 'DELETE',
    });
    expect(deleted.success).toBe(true);

    tables = await storeRequest<Table[]>('/tables');
    expect(tables.some((entry) => entry.id === table.id)).toBe(false);
  });

  it('T-05: relatório filtra por período com início e fim inclusivos', async () => {
    const yesterday = dayAt(-1);
    const today = dayAt(0);
    const tomorrow = dayAt(1);

    await storeRequest('/expenses', {
      method: 'POST',
      body: JSON.stringify({ description: 'Despesa de ontem', amount: 50, incurredAt: yesterday.toISOString() }),
    });
    await storeRequest('/expenses', {
      method: 'POST',
      body: JSON.stringify({ description: 'Despesa de hoje', amount: 30, incurredAt: today.toISOString() }),
    });
    await storeRequest('/expenses', {
      method: 'POST',
      body: JSON.stringify({ description: 'Despesa de amanhã', amount: 70, incurredAt: tomorrow.toISOString() }),
    });

    const table = await createTable(95);
    const item = await createMenuItem('Item do período', 20);
    const order = await addItem(table.id, item.id, 1);
    await closeOrder(order.id);

    const todayStr = localDate(new Date());
    const todayReport = await report(todayStr, todayStr);
    expect(todayReport.expenseCount).toBe(1);
    expect(todayReport.expenses).toBe('30.00');
    expect(todayReport.paidOrders).toBe(1);
    expect(todayReport.revenue).toBe('20.00');

    const wideReport = await report(localDate(yesterday), localDate(tomorrow));
    expect(wideReport.expenseCount).toBe(3);
    expect(wideReport.expenses).toBe('150.00');
    expect(wideReport.paidOrders).toBe(1);
    expect(wideReport.revenue).toBe('20.00');
  });

  it('T-06: período com início posterior ao fim é rejeitado', async () => {
    await expect(report('2026-11-10', '2026-11-09')).rejects.toThrow(
      'A data inicial deve ser anterior ou igual à data final.'
    );
  });
});
