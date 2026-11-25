import { localDate, orderTotalCents } from './format';
import { dueCents } from './comanda';
import { isValidMoney } from './validacao';
import { CANCEL_CLOSED_MESSAGE } from './ajustes-comanda';
import { SPLIT_LOCKED, validateDrafts } from './divisao';
import type { Expense, Ingredient, MenuItem, Order, OrderItem, Recipe, Report, Table } from './types';
import { cleanZoneName, deleteBlocker, duplicateZone, nextSortOrder, sortZones, validateZoneName, withZones, ZONE_MESSAGES, type Zone } from './zonas';
import { cleanReason, MOVE_MESSAGES, validateReason, type OrderEvent } from './mover';
import {
  findIngredientDuplicate, ingredientName, INGREDIENT_IN_USE, recipeView,
  sortIngredients, validateCost, validateIngredientName, validateRecipe, validateUnit,
} from './ficha-tecnica';

type StoredTable = Omit<Table, 'order'>;
type StoredOrder = Order & { tableId: number | null };
// zones: SPEC/2026-11-17-zonas-do-salao.md; events: SPEC/2026-11-17-mover-e-juntar-na-tela.md.
// ingredients/recipes: SPEC/2026-11-19-ficha-tecnica-e-margem.md.
type RestaurantData = { zones: Zone[]; tables: StoredTable[]; menu: MenuItem[]; orders: StoredOrder[]; expenses: Expense[]; events: OrderEvent[]; ingredients: Ingredient[]; recipes: Recipe[] };

export const STORAGE_KEY = 'mesa-clara.data.v1';
const PAYMENT_METHODS = ['CASH', 'CREDIT', 'DEBIT', 'PIX'];

function initialData(): RestaurantData {
  return {
    zones: [{ id: 1, name: 'Salão', sortOrder: 1 }],
    tables: [
      { id: 1, number: 1, capacity: 2, zoneId: 1 }, { id: 2, number: 2, capacity: 2, zoneId: 1 },
      { id: 3, number: 3, capacity: 4, zoneId: 1 }, { id: 4, number: 4, capacity: 4, zoneId: 1 },
      { id: 5, number: 5, capacity: 6, zoneId: 1 },
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
    events: [],
    ingredients: [],
    recipes: [],
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
    const zoned = withZones(parsed.zones, Array.isArray(parsed.tables) ? parsed.tables : []);
    return {
      zones: zoned.zones,
      tables: zoned.tables,
      menu: Array.isArray(parsed.menu) ? parsed.menu : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
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

function dateFilter(date: string, from: string, to: string) {
  const day = localDate(new Date(date));
  return day >= from && day <= to;
}

function bodyOf(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== 'string') return {};
  try { return JSON.parse(init.body) as Record<string, unknown>; }
  catch { throw new Error('Os dados enviados são inválidos.'); }
}

/** Adaptador local: mesma interface da API, com os dados neste navegador. */
export async function localRequest<T>(path: string, init?: RequestInit): Promise<T> {
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
    // RF-03: sem zona, a primeira; zona inexistente é recusada (RN-05).
    const zoneId = payload.zoneId === undefined ? sortZones(data.zones)[0].id : Number(payload.zoneId);
    if (!data.zones.some((zone) => zone.id === zoneId)) throw new Error(ZONE_MESSAGES.notFound);
    const table = { id: nextId(data.tables), number, capacity, zoneId };
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
  } else if (method === 'PATCH' && url.pathname.match(/^\/tables\/\d+$/)) {
    // RF-04 e RN-05 da SPEC/2026-11-17-zonas-do-salao.md
    const table = data.tables.find((entry) => entry.id === Number(url.pathname.split('/')[2]));
    if (!table) throw new Error('Mesa não encontrada.');
    const zoneId = Number(payload.zoneId);
    if (!data.zones.some((zone) => zone.id === zoneId)) throw new Error(ZONE_MESSAGES.notFound);
    table.zoneId = zoneId;
    writeData(data);
    result = table;
  } else if (url.pathname === '/zones' && method === 'GET') {
    // RF-01
    result = sortZones(data.zones).map((zone) => ({ ...zone, tableCount: data.tables.filter((table) => table.zoneId === zone.id).length }));
  } else if (url.pathname === '/zones' && method === 'POST') {
    // RF-02, RN-01, RN-02 e RN-06
    const name = String(payload.name ?? '');
    const invalid = validateZoneName(name);
    if (invalid) throw new Error(invalid);
    const same = duplicateZone(data.zones, name);
    if (same) throw new Error(ZONE_MESSAGES.duplicate(same.name));
    const zone = { id: nextId(data.zones), name: cleanZoneName(name), sortOrder: nextSortOrder(data.zones) };
    data.zones.push(zone);
    writeData(data);
    result = zone;
  } else if (method === 'PATCH' && url.pathname.match(/^\/zones\/\d+$/)) {
    const zone = data.zones.find((entry) => entry.id === Number(url.pathname.split('/')[2]));
    if (!zone) throw new Error(ZONE_MESSAGES.notFound);
    const name = String(payload.name ?? '');
    const invalid = validateZoneName(name);
    if (invalid) throw new Error(invalid);
    const same = duplicateZone(data.zones, name, zone.id);
    if (same) throw new Error(ZONE_MESSAGES.duplicate(same.name));
    zone.name = cleanZoneName(name);
    writeData(data);
    result = zone;
  } else if (method === 'DELETE' && url.pathname.match(/^\/zones\/\d+$/)) {
    // RN-03
    const zone = data.zones.find((entry) => entry.id === Number(url.pathname.split('/')[2]));
    if (!zone) throw new Error(ZONE_MESSAGES.notFound);
    const blocker = deleteBlocker(zone, data.zones, data.tables.filter((table) => table.zoneId === zone.id).length);
    if (blocker) throw new Error(blocker);
    data.zones = data.zones.filter((entry) => entry.id !== zone.id);
    writeData(data);
    result = { success: true };
  } else if (url.pathname === '/ingredients' && method === 'GET') {
    result = sortIngredients(data.ingredients).map((ingredient) => ({
      ...ingredient,
      usage: data.recipes.filter((recipe) => recipe.items.some((item) => item.ingredientId === ingredient.id)).length,
    }));
  } else if (url.pathname === '/ingredients' && method === 'POST') {
    const name = ingredientName(String(payload.name ?? ''));
    const unit = String(payload.unit ?? '');
    const cost = String(payload.cost ?? '');
    const invalid = validateIngredientName(name) ?? validateUnit(unit) ?? validateCost(cost);
    if (invalid) throw new Error(invalid);
    if (findIngredientDuplicate(data.ingredients, name)) throw new Error('Já existe um ingrediente com esse nome.');
    const ingredient: Ingredient = {
      id: nextId(data.ingredients), name, unit: unit as Ingredient['unit'],
      cost: Number(cost.replace(',', '.')).toFixed(2),
    };
    data.ingredients.push(ingredient);
    writeData(data);
    result = ingredient;
  } else if (method === 'PATCH' && url.pathname.match(/^\/ingredients\/\d+$/)) {
    const id = Number(url.pathname.split('/')[2]);
    const ingredient = data.ingredients.find((entry) => entry.id === id);
    if (!ingredient) throw new Error('Ingrediente não encontrado.');
    const name = payload.name === undefined ? ingredient.name : ingredientName(String(payload.name));
    const unit = payload.unit === undefined ? ingredient.unit : String(payload.unit);
    const cost = payload.cost === undefined ? ingredient.cost : String(payload.cost);
    const invalid = validateIngredientName(name) ?? validateUnit(unit) ?? validateCost(cost);
    if (invalid) throw new Error(invalid);
    if (findIngredientDuplicate(data.ingredients, name, id)) throw new Error('Já existe um ingrediente com esse nome.');
    ingredient.name = name;
    ingredient.unit = unit as Ingredient['unit'];
    ingredient.cost = Number(cost.replace(',', '.')).toFixed(2);
    writeData(data);
    result = ingredient;
  } else if (method === 'DELETE' && url.pathname.match(/^\/ingredients\/\d+$/)) {
    const id = Number(url.pathname.split('/')[2]);
    if (!data.ingredients.some((entry) => entry.id === id)) throw new Error('Ingrediente não encontrado.');
    if (data.recipes.some((recipe) => recipe.items.some((item) => item.ingredientId === id))) throw new Error(INGREDIENT_IN_USE);
    data.ingredients = data.ingredients.filter((entry) => entry.id !== id);
    writeData(data);
    result = { success: true };
  } else if (method === 'GET' && url.pathname.match(/^\/menu-items\/\d+\/recipe$/)) {
    const menuItemId = Number(url.pathname.split('/')[2]);
    const menuItem = data.menu.find((entry) => entry.id === menuItemId);
    if (!menuItem) throw new Error('Item do cardápio não encontrado.');
    const recipe = data.recipes.find((entry) => entry.menuItemId === menuItemId);
    result = recipeView(menuItem, recipe, data.ingredients);
  } else if (method === 'PUT' && url.pathname.match(/^\/menu-items\/\d+\/recipe$/)) {
    const menuItemId = Number(url.pathname.split('/')[2]);
    const menuItem = data.menu.find((entry) => entry.id === menuItemId);
    if (!menuItem) throw new Error('Item do cardápio não encontrado.');
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const items = rawItems.map((item) => {
      const entry = item as Record<string, unknown>;
      return { ingredientId: Number(entry.ingredientId), quantity: Number(entry.quantity) };
    });
    const invalid = validateRecipe(items, data.ingredients);
    if (invalid) throw new Error(invalid);
    data.recipes = data.recipes.filter((entry) => entry.menuItemId !== menuItemId);
    if (items.length) data.recipes.push({ menuItemId, items });
    writeData(data);
    const recipe = data.recipes.find((entry) => entry.menuItemId === menuItemId);
    result = recipeView(menuItem, recipe, data.ingredients);
  } else if (url.pathname === '/menu-items' && method === 'GET') {
    result = url.searchParams.get('all') === 'true' ? data.menu : data.menu.filter((item) => item.available);
  } else if (url.pathname === '/menu-items' && method === 'POST') {
    const name = String(payload.name ?? '').trim();
    const price = Number(payload.price);
    if (!name) throw new Error('Informe o nome do item.');
    if (!isValidMoney(price)) throw new Error('Informe um preço válido.');
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
      if (!isValidMoney(price)) throw new Error('Informe um preço válido.');
      item.price = price.toFixed(2);
    }
    if (payload.available !== undefined) item.available = Boolean(payload.available);
    writeData(data);
    result = item;
  } else if (method === 'DELETE' && url.pathname.match(/^\/menu-items\/\d+$/)) {
    const id = Number(url.pathname.split('/')[2]);
    if (!data.menu.some((item) => item.id === id)) throw new Error('Item do cardápio não encontrado.');
    data.menu = data.menu.filter((item) => item.id !== id);
    data.recipes = data.recipes.filter((recipe) => recipe.menuItemId !== id);
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
    if (order?.splits?.length) throw new Error(SPLIT_LOCKED);
    if (!order) {
      order = { id: nextId(data.orders), tableId, tableNumber: table.number, status: 'OPEN', openedAt: new Date().toISOString(), items: [] };
      data.orders.push(order);
    }
    order.items.push({ id: nextId(order.items), menuItemId: item.id, nameSnapshot: item.name, unitPrice: item.price, quantity });
    writeData(data);
    result = order;
  } else if (method === 'POST' && url.pathname.match(/^\/orders\/\d+\/transfer$/)) {
    // RF-04 da SPEC/2026-11-17-mover-e-juntar-na-tela.md: RN-01 a RN-03 com as mensagens da API.
    const order = data.orders.find((entry) => entry.id === Number(url.pathname.split('/')[2]));
    if (!order) throw new Error(MOVE_MESSAGES.orderNotFound);
    const reasonProblem = validateReason(String(payload.reason ?? ''));
    if (reasonProblem) throw new Error(reasonProblem);
    if (order.status !== 'OPEN') throw new Error(MOVE_MESSAGES.transferClosed);
    const target = data.tables.find((table) => table.id === Number(payload.tableId));
    if (!target) throw new Error(MOVE_MESSAGES.tableNotFound);
    if (target.id === order.tableId) throw new Error(MOVE_MESSAGES.sameTable);
    if (data.orders.some((entry) => entry.tableId === target.id && entry.status === 'OPEN')) throw new Error(MOVE_MESSAGES.occupied(target.number));
    const fromTableNumber = order.tableNumber;
    order.tableId = target.id;
    order.tableNumber = target.number;
    data.events.push({
      id: nextId(data.events), orderId: order.id, type: 'TRANSFER', fromTableNumber, toTableNumber: target.number,
      sourceOrderId: null, reason: cleanReason(String(payload.reason)), createdAt: new Date().toISOString(),
    });
    writeData(data);
    result = order;
  } else if (method === 'POST' && url.pathname.match(/^\/orders\/\d+\/merge$/)) {
    const target = data.orders.find((entry) => entry.id === Number(url.pathname.split('/')[2]));
    const source = data.orders.find((entry) => entry.id === Number(payload.sourceOrderId));
    if (!target || !source) throw new Error(MOVE_MESSAGES.orderNotFound);
    const reasonProblem = validateReason(String(payload.reason ?? ''));
    if (reasonProblem) throw new Error(reasonProblem);
    if (target.id === source.id) throw new Error(MOVE_MESSAGES.sameOrder);
    if (target.status !== 'OPEN' || source.status !== 'OPEN') throw new Error(MOVE_MESSAGES.mergeClosed);
    if (target.splits?.length || source.splits?.length) throw new Error(SPLIT_LOCKED);
    // RNF-02 da API: os itens mudam de comanda com o nome e o preço guardados.
    for (const line of source.items) target.items.push({ ...line, id: nextId(target.items) });
    const reason = cleanReason(String(payload.reason));
    const createdAt = new Date().toISOString();
    const base = { type: 'MERGE' as const, fromTableNumber: source.tableNumber, toTableNumber: target.tableNumber, sourceOrderId: source.id, reason, createdAt };
    data.events.push({ id: nextId(data.events), orderId: target.id, ...base });
    data.events.push({ id: nextId(data.events), orderId: source.id, ...base });
    source.items = [];
    source.status = 'MERGED';
    source.tableId = null;
    writeData(data);
    result = target;
  } else if (method === 'GET' && url.pathname.match(/^\/orders\/\d+\/history$/)) {
    const orderId = Number(url.pathname.split('/')[2]);
    if (!data.orders.some((entry) => entry.id === orderId)) throw new Error(MOVE_MESSAGES.orderNotFound);
    result = data.events.filter((event) => event.orderId === orderId).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  } else if (method === 'POST' && url.pathname.match(/^\/orders\/\d+\/splits$/)) {
    const order = data.orders.find((entry) => entry.id === Number(url.pathname.split('/')[2]));
    if (!order) throw new Error('Comanda não encontrada.');
    if (order.status !== 'OPEN') throw new Error('Esta comanda já foi fechada.');
    if (order.splits?.length) throw new Error('A comanda já está dividida.');
    if (!order.items.length) throw new Error('Adicione pelo menos um item antes de dividir a conta.');
    const raw = Array.isArray(payload.splits) ? payload.splits : [];
    const drafts = raw.map((entry) => {
      const split = entry as Record<string, unknown>;
      return {
        name: String(split.name ?? ''),
        amount: String(split.amount ?? ''),
        items: Array.isArray(split.items)
          ? split.items.map((item) => {
            const line = item as Record<string, unknown>;
            return { itemId: Number(line.itemId), quantity: Number(line.quantity) };
          })
          : undefined,
      };
    });
    const invalid = validateDrafts(drafts, dueCents(order));
    if (invalid) throw new Error(invalid);
    order.splits = drafts.map((draft, index) => ({
      id: index + 1, name: draft.name.trim(), amount: draft.amount, paid: false,
      paymentMethod: null, paidAt: null, ...(draft.items ? { items: draft.items } : {}),
    }));
    writeData(data);
    result = order;
  } else if (method === 'POST' && url.pathname.match(/^\/orders\/\d+\/splits\/\d+\/pay$/)) {
    const [, , orderIdRaw, , splitIdRaw] = url.pathname.split('/');
    const order = data.orders.find((entry) => entry.id === Number(orderIdRaw));
    if (!order) throw new Error('Comanda não encontrada.');
    if (order.status !== 'OPEN') throw new Error('Esta comanda já foi fechada.');
    const split = order.splits?.find((entry) => entry.id === Number(splitIdRaw));
    if (!split) throw new Error('Parcela não encontrada.');
    if (split.paid) throw new Error('Esta parcela já foi paga.');
    if (!PAYMENT_METHODS.includes(String(payload.paymentMethod))) throw new Error('Selecione uma forma de pagamento válida.');
    split.paid = true;
    split.paymentMethod = String(payload.paymentMethod);
    split.paidAt = new Date().toISOString();
    if (order.splits!.every((entry) => entry.paid)) {
      order.status = 'PAID';
      order.paidAt = new Date().toISOString();
      const methods = [...new Set(order.splits!.map((entry) => entry.paymentMethod).filter(Boolean))];
      order.paymentMethod = methods.length === 1 ? methods[0] : 'MIXED';
    }
    writeData(data);
    result = order;
  } else if (method === 'DELETE' && url.pathname.match(/^\/orders\/\d+\/splits$/)) {
    const order = data.orders.find((entry) => entry.id === Number(url.pathname.split('/')[2]));
    if (!order) throw new Error('Comanda não encontrada.');
    if (order.splits?.some((split) => split.paid)) throw new Error('Já há parcela paga; não é possível desfazer a divisão.');
    order.splits = [];
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
    if (order.splits?.length) throw new Error(SPLIT_LOCKED);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) throw new Error('Informe uma quantidade entre 1 e 500.');
    line.quantity = quantity;
    writeData(data);
    result = order;
  } else if (method === 'DELETE' && url.pathname.match(/^\/orders\/\d+\/items\/\d+$/)) {
    const [, , orderIdRaw, , itemIdRaw] = url.pathname.split('/');
    const order = data.orders.find((entry) => entry.id === Number(orderIdRaw) && entry.status === 'OPEN');
    if (!order || !order.items.some((entry) => entry.id === Number(itemIdRaw))) throw new Error('Item da comanda não encontrado.');
    if (order.splits?.length) throw new Error(SPLIT_LOCKED);
    order.items = order.items.filter((entry) => entry.id !== Number(itemIdRaw));
    if (!order.items.length) data.orders = data.orders.filter((entry) => entry.id !== order.id);
    writeData(data);
    result = { success: true };
  } else if (method === 'POST' && url.pathname.match(/^\/orders\/\d+\/cancel$/)) {
    // RF-03 da SPEC/2026-11-17-quantidade-e-cancelamento-na-comanda.md: mesma regra da API.
    const order = data.orders.find((entry) => entry.id === Number(url.pathname.split('/')[2]));
    if (!order) throw new Error('Comanda não encontrada.');
    if (order.status !== 'OPEN') throw new Error(CANCEL_CLOSED_MESSAGE);
    order.status = 'CANCELLED';
    writeData(data);
    result = order;
  } else if (method === 'POST' && url.pathname.match(/^\/orders\/\d+\/close$/)) {
    const orderId = Number(url.pathname.split('/')[2]);
    const order = data.orders.find((entry) => entry.id === orderId);
    if (!order) throw new Error('Comanda não encontrada.');
    if (order.status !== 'OPEN') throw new Error('Esta comanda já foi fechada.');
    if (!order.items.length) throw new Error('Adicione pelo menos um item antes de fechar a conta.');
    if (order.splits?.length && !order.splits.every((split) => split.paid)) throw new Error('A comanda tem parcelas em aberto.');
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
    if (!isValidMoney(amount)) throw new Error('Informe um valor válido.');
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
    for (const order of paidOrders) {
      if (order.splits?.length) {
        for (const split of order.splits) {
          if (split.paid && split.paymentMethod) paymentsCents[split.paymentMethod] += Math.round(Number(split.amount) * 100);
        }
      } else if (order.paymentMethod) {
        paymentsCents[order.paymentMethod] += orderTotalCents(order);
      }
    }
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

/** Le os dados crus do navegador, para a importação para a API. */
export function readLocalData(): RestaurantData {
  return readData();
}
