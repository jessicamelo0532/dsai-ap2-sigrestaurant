import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasLocalData, importLocalData } from './import-local';
import { STORAGE_KEY } from './local-store';

const BASE_URL = 'http://localhost:4000/api';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => void map.set(key, String(value)),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
}

const LOCAL_DATA = {
  tables: [
    { id: 1, number: 7, capacity: 4 },
    { id: 2, number: 8, capacity: 2 },
  ],
  menu: [
    { id: 1, name: 'Tacacá', description: 'Do tambor', category: 'Entradas', price: '18.50', available: true },
    { id: 2, name: 'Pirarucu', description: null, category: 'Pratos', price: '72.00', available: false },
  ],
  orders: [
    {
      id: 1,
      tableId: 1,
      tableNumber: 7,
      status: 'OPEN',
      openedAt: '2026-11-14T12:00:00.000Z',
      items: [{ id: 1, menuItemId: 1, nameSnapshot: 'Tacacá', unitPrice: '18.50', quantity: 2 }],
    },
  ],
  expenses: [{ id: 1, description: 'Gás', amount: '120.00', incurredAt: '2026-11-13T12:00:00.000Z' }],
};

describe('importação dos dados do navegador para a API (SPEC/2026-11-14-frontend-em-modo-api)', () => {
  let calls: { url: string; method: string; body: unknown }[];

  beforeEach(() => {
    calls = [];
    const storage = memoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
    storage.setItem(STORAGE_KEY, JSON.stringify(LOCAL_DATA));

    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method || 'GET').toUpperCase();
      calls.push({ url: String(url), method, body: init.body ? JSON.parse(String(init.body)) : null });

      if (method === 'GET' && String(url).endsWith('/tables')) return new Response(JSON.stringify([]), { status: 200 });
      if (method === 'GET' && String(url).includes('/menu-items')) return new Response(JSON.stringify([]), { status: 200 });
      if (method === 'POST' && String(url).endsWith('/tables')) {
        const body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ id: 100 + body.number, ...body }), { status: 200 });
      }
      if (method === 'POST' && String(url).endsWith('/menu-items')) {
        const body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ id: 200 + body.name.length, ...body }), { status: 200 });
      }
      if (method === 'POST' && String(url).endsWith('/expenses')) return new Response(JSON.stringify({ id: 9 }), { status: 200 });
      if (method === 'POST' && /\/tables\/\d+\/items$/.test(String(url))) return new Response(JSON.stringify({ id: 5 }), { status: 200 });
      return new Response('{}', { status: 200 });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('T-17: leva mesas, cardápio, despesas e a comanda aberta para a API', async () => {
    const report = await importLocalData(BASE_URL);

    expect(report).toEqual({
      tablesCreated: 2,
      menuItemsCreated: 2,
      expensesCreated: 1,
      orderLinesSent: 1,
      skipped: 0,
    });

    const metodos = calls.map((call) => `${call.method} ${call.url.replace(BASE_URL, '')}`);
    expect(metodos).toEqual([
      'GET /tables',
      'GET /menu-items?all=true',
      'POST /tables',
      'POST /tables',
      'POST /menu-items',
      'POST /menu-items',
      'POST /expenses',
      'POST /tables/107/items',
    ]);

    const itemCall = calls.find((call) => call.url.endsWith('/items'));
    expect(itemCall?.body).toEqual({ menuItemId: 206, quantity: 2 });
  });

  it('T-17b: reaproveita mesa e item que já existem no servidor, sem duplicar', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method || 'GET').toUpperCase();
      calls.push({ url: String(url), method, body: init.body ? JSON.parse(String(init.body)) : null });
      if (method === 'GET' && String(url).endsWith('/tables')) {
        return new Response(JSON.stringify([{ id: 50, number: 7, capacity: 4, order: null }]), { status: 200 });
      }
      if (method === 'GET' && String(url).includes('/menu-items')) {
        return new Response(JSON.stringify([{ id: 60, name: 'Tacacá', description: null, category: 'Entradas', price: '18.50', available: true }]), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }));

    const report = await importLocalData(BASE_URL);

    expect(report.tablesCreated).toBe(1);
    expect(report.menuItemsCreated).toBe(1);
    expect(report.orderLinesSent).toBe(1);
    const itemCall = calls.find((call) => call.url.endsWith('/items'));
    expect(itemCall?.body).toEqual({ menuItemId: 60, quantity: 2 });
  });

  it('T-17c: os dados do navegador continuam intactos depois da importação', async () => {
    await importLocalData(BASE_URL);
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.tables).toHaveLength(2);
    expect(stored.menu).toHaveLength(2);
    expect(stored.expenses).toHaveLength(1);
    expect(stored.orders).toHaveLength(1);
  });

  it('T-17d: detecta se há dados no navegador para oferecer a importação', () => {
    expect(hasLocalData()).toBe(true);
  });
});
