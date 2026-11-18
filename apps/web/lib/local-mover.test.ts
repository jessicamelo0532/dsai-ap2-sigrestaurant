// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { localRequest, STORAGE_KEY } from './local-store';
import type { OrderEvent } from './mover';
import type { Order, Report, Table } from './types';

// SPEC/2026-11-17-mover-e-juntar-na-tela.md (T-02): rotas no modo navegador.
const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const tables = () => localRequest<Table[]>('/tables');
const tableOf = async (number: number) => (await tables()).find((table) => table.number === number)!;
const launch = (tableId: number, menuItemId: number, quantity = 1) => localRequest<Order>(`/tables/${tableId}/items`, json('POST', { menuItemId, quantity }));

beforeEach(() => { window.localStorage.clear(); });

describe('transferir (CA-01, CA-04)', () => {
  it('leva a comanda para a mesa livre e registra o histórico', async () => {
    const order = await launch(1, 1);

    const moved = await localRequest<Order>(`/orders/${order.id}/transfer`, json('POST', { tableId: 2, reason: ' Cliente pediu janela ' }));

    expect(moved.tableNumber).toBe(2);
    expect((await tableOf(1)).order).toBeNull();
    expect((await tableOf(2)).order?.id).toBe(order.id);
    const [event] = await localRequest<OrderEvent[]>(`/orders/${order.id}/history`);
    expect(event).toMatchObject({ type: 'TRANSFER', fromTableNumber: 1, toTableNumber: 2, reason: 'Cliente pediu janela' });
  });

  it('recusa mesa ocupada, a mesma mesa, mesa inexistente e motivo curto', async () => {
    const order = await launch(1, 1);
    await launch(3, 2);
    const transfer = (tableId: number, reason = 'Pedido do cliente') => localRequest(`/orders/${order.id}/transfer`, json('POST', { tableId, reason }));

    await expect(transfer(3)).rejects.toThrow('A mesa 3 já tem uma comanda aberta. Junte as contas em vez de transferir.');
    await expect(transfer(1)).rejects.toThrow('A comanda já está nessa mesa.');
    await expect(transfer(99)).rejects.toThrow('Mesa não encontrada.');
    await expect(transfer(2, 'ok')).rejects.toThrow('Informe o motivo, de 3 a 200 caracteres.');
  });

  it('recusa comanda paga', async () => {
    const order = await launch(1, 1);
    await localRequest(`/orders/${order.id}/close`, json('POST', { paymentMethod: 'PIX' }));

    await expect(localRequest(`/orders/${order.id}/transfer`, json('POST', { tableId: 2, reason: 'Pedido do cliente' }))).rejects.toThrow('Só comandas abertas podem mudar de mesa.');
  });
});

describe('juntar (CA-02, CA-04, CA-05)', () => {
  it('traz os itens, soma o total, libera a mesa de origem e registra nos dois lados', async () => {
    const target = await launch(1, 1, 2);
    const source = await launch(3, 4, 1);

    const merged = await localRequest<Order>(`/orders/${target.id}/merge`, json('POST', { sourceOrderId: source.id, reason: 'Mesmo grupo' }));

    expect(merged.items.map((line) => [line.nameSnapshot, line.quantity])).toEqual([['Bruschetta da casa', 2], ['Limonada da casa', 1]]);
    expect((await tableOf(3)).order).toBeNull();
    const [targetEvent] = await localRequest<OrderEvent[]>(`/orders/${target.id}/history`);
    const [sourceEvent] = await localRequest<OrderEvent[]>(`/orders/${source.id}/history`);
    expect(targetEvent).toMatchObject({ type: 'MERGE', sourceOrderId: source.id, fromTableNumber: 3, toTableNumber: 1 });
    expect(sourceEvent).toMatchObject({ orderId: source.id, type: 'MERGE' });

    await localRequest(`/orders/${target.id}/close`, json('POST', { paymentMethod: 'CASH' }));
    const today = new Date();
    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const report = await localRequest<Report>(`/reports/financial?from=${day}&to=${day}`);
    expect(report).toMatchObject({ paidOrders: 1, revenue: '64.00' });
  });

  it('recusa a mesma comanda, comanda fechada e motivo curto', async () => {
    const target = await launch(1, 1);
    const source = await launch(3, 2);
    const merge = (sourceOrderId: number, reason = 'Mesmo grupo') => localRequest(`/orders/${target.id}/merge`, json('POST', { sourceOrderId, reason }));

    await expect(merge(target.id)).rejects.toThrow('Escolha duas comandas diferentes.');
    await expect(merge(source.id, 'x')).rejects.toThrow('Informe o motivo, de 3 a 200 caracteres.');
    await expect(merge(999)).rejects.toThrow('Comanda não encontrada.');
    await localRequest(`/orders/${source.id}/close`, json('POST', { paymentMethod: 'PIX' }));
    await expect(merge(source.id)).rejects.toThrow('Só comandas abertas podem ser juntadas.');
  });
});

describe('dados antigos (RNF-03)', () => {
  it('sem lista de eventos, o histórico começa vazio', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tables: [{ id: 1, number: 1, capacity: 2 }], menu: [], expenses: [],
      orders: [{ id: 5, tableId: 1, tableNumber: 1, status: 'OPEN', openedAt: '2026-11-17T12:00:00.000Z', items: [] }],
    }));

    expect(await localRequest(`/orders/5/history`)).toEqual([]);
    await expect(localRequest(`/orders/6/history`)).rejects.toThrow('Comanda não encontrada.');
  });
});
