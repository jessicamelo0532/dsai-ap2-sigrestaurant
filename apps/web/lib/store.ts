export type OrderItem = { id: number; menuItemId: number | null; nameSnapshot: string; unitPrice: string; quantity: number };
export type Order = { id: number; tableNumber: number; status: 'OPEN' | 'PAID' | 'CANCELLED'; paymentMethod?: string | null; openedAt: string; paidAt?: string | null; items: OrderItem[] };
export type Table = { id: number; number: number; capacity: number; order: Order | null };
export type MenuItem = { id: number; name: string; description: string | null; category: string; price: string; available: boolean };
export type Expense = { id: number; description: string; amount: string; incurredAt: string };
export type Report = { paidOrders: number; revenue: string; expenses: string; expenseCount: number; balance: string; payments: Record<string, string> };

type StoredTable = Omit<Table, 'order'>;
type StoredOrder = Order & { tableId: number | null };
type RestaurantData = { tables: StoredTable[]; menu: MenuItem[]; orders: StoredOrder[]; expenses: Expense[] };

const STORAGE_KEY = 'mesa-clara.data.v1';
const PAYMENT_METHODS = ['CASH', 'CREDIT', 'DEBIT', 'PIX'];

function initialData(): RestaurantData {
  return {
    tables: [
      { id: 1, number: 1, capacity: 2 }, { id: 2, number: 2, capacity: 2 },
      { id: 3, number: 3, capacity: 4 }, { id: 4, number: 4, capacity: 4 },
      { id: 5, number: 5, capacity: 6 },
    ],
    menu: [
      { id: 1, name: 'Bruschetta da casa', category: 'Entradas', description: 'Tomate fresco, manjericão e pão tostado', price: '24.00', available: true },
      { id: 2, name: 'Risoto de cogumelos', category: 'Pratos principais', description: 'Arroz arbóreo, cogumelos e parmesão', price: '58.00', available: true },
      { id: 3, name: 'Peixe do dia', category: 'Pratos principais', description: 'Pesca fresca com legumes da estação', price: '72.00', available: true },
      { id: 4, name: 'Limonada da casa', category: 'Bebidas', description: 'Limão, hortelã e água com gás', price: '16.00', available: true },
      { id: 5, name: 'Pudim de cumaru', category: 'Sobremesas', description: 'Pudim cremoso com calda de caramelo', price: '22.00', available: true },
    ],
    orders: [],
    expenses: [],
  };
}

function readData(): RestaurantData {
  if (typeof window === 'undefined') return initialData();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const fresh = initialData();
      writeData(fresh);
      return fresh;
    }
    const parsed = JSON.parse(stored) as Partial<RestaurantData>;
    return {
      tables: Array.isArray(parsed.tables) ? parsed.tables : [],
      menu: Array.isArray(parsed.menu) ? parsed.menu : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    };
  } catch {
    const fresh = initialData();
    writeData(fresh);
    return fresh;
  }
}

function writeData(data: RestaurantData) {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function nextId<T extends { id: number }>(values: T[]) {
  return values.reduce((max, value) => Math.max(max, value.id), 0) + 1;
}

function moneyDecimal(cents: number) {
  return (cents / 100).toFixed(2);
}

function orderTotalCents(order: Order) {
  return order.items.reduce((total, line) => total + Math.round(Number(line.unitPrice) * 100) * line.quantity, 0);
}

function dateFilter(date: string, from: string, to: string) {
  const day = localDate(new Date(date));
  return day >= from && day <= to;
}

function bodyOf(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== 'string') return {};
  try { return JSON.parse(init.body) as Record<string, unknown>; }
  catch { throw new Error('Os dados enviados são inválidos.'); }
}

/** Frontend-only data adapter. All state is local to this browser profile. */
export async function storeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, 'http://mesa-clara.local');
  const method = (init?.method || 'GET').toUpperCase();
  const data = readData();
  const payload = bodyOf(init);
  let result: unknown;

  if (url.pathname === '/tables' && method === 'GET') {
    result = data.tables.sort((a, b) => a.number - b.number).map((table) => ({
      ...table,
      order: data.orders.find((order) => order.tableId === table.id && order.status === 'OPEN') ?? null,
    }));
  } else if (url.pathname === '/tables' && method === 'POST') {
    const number = Number(payload.number);
    const capacity = Number(payload.capacity ?? 4);
    if (!Number.isInteger(number) || number < 1) throw new Error('Informe um número de mesa válido.');
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Informe uma quantidade de lugares válida.');
    if (data.tables.some((table) => table.number === number)) throw new Error('Já existe uma mesa com esse número.');
    const table = { id: nextId(data.tables), number, capacity };
    data.tables.push(table);
    writeData(data);
    result = table;
  } else if (method === 'DELETE' && url.pathname.match(/^\/tables\/\d+$/)) {
    const id = Number(url.pathname.split('/')[2]);
    const table = data.tables.find((entry) => entry.id === id);
    if (!table) throw new Error('Mesa não encontrada.');
    if (data.orders.some((order) => order.tableId === id && order.status === 'OPEN')) throw new Error('Feche a comanda antes de remover esta mesa.');
    data.tables = data.tables.filter((entry) => entry.id !== id);
    data.orders = data.orders.map((order) => order.tableId === id ? { ...order, tableId: null } : order);
    writeData(data);
    result = { success: true };
  } else if (url.pathname === '/menu-items' && method === 'GET') {
    result = url.searchParams.get('all') === 'true' ? data.menu : data.menu.filter((item) => item.available);
  } else if (url.pathname === '/menu-items' && method === 'POST') {
    const name = String(payload.name ?? '').trim();
    const price = Number(payload.price);
    if (!name) throw new Error('Informe o nome do item.');
    if (!Number.isFinite(price) || price <= 0) throw new Error('Informe um preço válido.');
    const item: MenuItem = {
      id: nextId(data.menu), name, description: String(payload.description ?? '').trim() || null,
      category: String(payload.category ?? 'Geral').trim() || 'Geral', price: price.toFixed(2), available: payload.available !== false,
    };
    data.menu.push(item);
    writeData(data);
    result = item;
  } else if (method === 'PATCH' && url.pathname.match(/^\/menu-items\/\d+$/)) {
    const id = Number(url.pathname.split('/')[2]);
    const item = data.menu.find((entry) => entry.id === id);
    if (!item) throw new Error('Item do cardápio não encontrado.');
    if (payload.name !== undefined) item.name = String(payload.name).trim();
    if (payload.description !== undefined) item.description = String(payload.description).trim() || null;
    if (payload.category !== undefined) item.category = String(payload.category).trim() || 'Geral';
    if (payload.price !== undefined) {
      const price = Number(payload.price);
      if (!Number.isFinite(price) || price <= 0) throw new Error('Informe um preço válido.');
      item.price = price.toFixed(2);
    }
    if (payload.available !== undefined) item.available = Boolean(payload.available);
    writeData(data);
    result = item;
  } else if (method === 'DELETE' && url.pathname.match(/^\/menu-items\/\d+$/)) {
    const id = Number(url.pathname.split('/')[2]);
    if (!data.menu.some((item) => item.id === id)) throw new Error('Item do cardápio não encontrado.');
    data.menu = data.menu.filter((item) => item.id !== id);
    data.orders = data.orders.map((order) => ({ ...order, items: order.items.map((line) => line.menuItemId === id ? { ...line, menuItemId: null } : line) }));
    writeData(data);
    result = { success: true };
  } else if (method === 'POST' && url.pathname.match(/^\/tables\/\d+\/items$/)) {
    const tableId = Number(url.pathname.split('/')[2]);
    const table = data.tables.find((entry) => entry.id === tableId);
    if (!table) throw new Error('Mesa não encontrada.');
    const item = data.menu.find((entry) => entry.id === Number(payload.menuItemId) && entry.available);
    if (!item) throw new Error('Este item não está disponível no cardápio.');
    const quantity = Number(payload.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) throw new Error('Informe uma quantidade entre 1 e 500.');
    let order = data.orders.find((entry) => entry.tableId === tableId && entry.status === 'OPEN');
    if (!order) {
      order = { id: nextId(data.orders), tableId, tableNumber: table.number, status: 'OPEN', openedAt: new Date().toISOString(), items: [] };
      data.orders.push(order);
    }
    order.items.push({ id: nextId(order.items), menuItemId: item.id, nameSnapshot: item.name, unitPrice: item.price, quantity });
    writeData(data);
    result = order;
  } else if (url.pathname === '/orders/open' && method === 'GET') {
    result = data.orders.filter((order) => order.status === 'OPEN');
  } else if (method === 'PATCH' && url.pathname.match(/^\/orders\/\d+\/items\/\d+$/)) {
    const [, , orderIdRaw, , itemIdRaw] = url.pathname.split('/');
    const order = data.orders.find((entry) => entry.id === Number(orderIdRaw) && entry.status === 'OPEN');
    const line = order?.items.find((entry) => entry.id === Number(itemIdRaw));
    const quantity = Number(payload.quantity);
    if (!order || !line) throw new Error('Item da comanda não encontrado.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) throw new Error('Informe uma quantidade entre 1 e 500.');
    line.quantity = quantity;
    writeData(data);
    result = order;
  } else if (method === 'DELETE' && url.pathname.match(/^\/orders\/\d+\/items\/\d+$/)) {
    const [, , orderIdRaw, , itemIdRaw] = url.pathname.split('/');
    const order = data.orders.find((entry) => entry.id === Number(orderIdRaw) && entry.status === 'OPEN');
    if (!order || !order.items.some((entry) => entry.id === Number(itemIdRaw))) throw new Error('Item da comanda não encontrado.');
    order.items = order.items.filter((entry) => entry.id !== Number(itemIdRaw));
    if (!order.items.length) data.orders = data.orders.filter((entry) => entry.id !== order.id);
    writeData(data);
    result = { success: true };
  } else if (method === 'POST' && url.pathname.match(/^\/orders\/\d+\/close$/)) {
    const orderId = Number(url.pathname.split('/')[2]);
    const order = data.orders.find((entry) => entry.id === orderId);
    if (!order) throw new Error('Comanda não encontrada.');
    if (order.status !== 'OPEN') throw new Error('Esta comanda já foi fechada.');
    if (!order.items.length) throw new Error('Adicione pelo menos um item antes de fechar a conta.');
    if (!PAYMENT_METHODS.includes(String(payload.paymentMethod))) throw new Error('Selecione uma forma de pagamento válida.');
    order.status = 'PAID';
    order.paymentMethod = String(payload.paymentMethod);
    order.paidAt = new Date().toISOString();
    writeData(data);
    result = order;
  } else if (url.pathname === '/expenses' && method === 'GET') {
    const from = url.searchParams.get('from') || '0000-01-01';
    const to = url.searchParams.get('to') || '9999-12-31';
    result = data.expenses.filter((expense) => dateFilter(expense.incurredAt, from, to)).sort((a, b) => b.incurredAt.localeCompare(a.incurredAt));
  } else if (url.pathname === '/expenses' && method === 'POST') {
    const description = String(payload.description ?? '').trim();
    const amount = Number(payload.amount);
    const incurredAt = payload.incurredAt ? new Date(String(payload.incurredAt)) : new Date();
    if (!description) throw new Error('Informe a descrição da despesa.');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Informe um valor válido.');
    if (Number.isNaN(incurredAt.getTime())) throw new Error('Data da despesa inválida.');
    const expense = { id: nextId(data.expenses), description, amount: amount.toFixed(2), incurredAt: incurredAt.toISOString() };
    data.expenses.push(expense);
    writeData(data);
    result = expense;
  } else if (url.pathname === '/reports/financial' && method === 'GET') {
    const from = url.searchParams.get('from') || localDate(new Date());
    const to = url.searchParams.get('to') || localDate(new Date());
    if (from > to) throw new Error('A data inicial deve ser anterior ou igual à data final.');
    const paidOrders = data.orders.filter((order) => order.status === 'PAID' && !!order.paidAt && dateFilter(order.paidAt, from, to));
    const expenses = data.expenses.filter((expense) => dateFilter(expense.incurredAt, from, to));
    const paymentsCents: Record<string, number> = Object.fromEntries(PAYMENT_METHODS.map((method) => [method, 0]));
    for (const order of paidOrders) if (order.paymentMethod) paymentsCents[order.paymentMethod] += orderTotalCents(order);
    const revenueCents = Object.values(paymentsCents).reduce((sum, cents) => sum + cents, 0);
    const expenseCents = expenses.reduce((sum, expense) => sum + Math.round(Number(expense.amount) * 100), 0);
    const report: Report = {
      paidOrders: paidOrders.length, revenue: moneyDecimal(revenueCents), expenses: moneyDecimal(expenseCents),
      expenseCount: expenses.length, balance: moneyDecimal(revenueCents - expenseCents),
      payments: Object.fromEntries(Object.entries(paymentsCents).map(([method, cents]) => [method, moneyDecimal(cents)])),
    };
    result = report;
  } else {
    throw new Error('Operação não disponível no modo frontend.');
  }

  return result as T;
}

export const money = (value: string | number) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const orderTotal = (order: Order | null) => order ? orderTotalCents(order) / 100 : 0;
export const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
