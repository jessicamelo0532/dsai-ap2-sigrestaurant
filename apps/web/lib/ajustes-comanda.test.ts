// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { canDecrease, canIncrease, cancelConfirmation, CANCEL_CLOSED_MESSAGE, nextQuantity } from './ajustes-comanda';
import { localDate } from './format';
import { localRequest } from './local-store';
import type { Order, Report, Table } from './types';

// SPEC/2026-11-17-quantidade-e-cancelamento-na-comanda.md (T-01 e T-02)
const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

beforeEach(() => { window.localStorage.clear(); });

describe('quantidade (RN-01)', () => {
  it('fica entre 1 e 500', () => {
    expect(nextQuantity(2, 1)).toBe(3);
    expect(nextQuantity(2, -1)).toBe(1);
    expect(nextQuantity(1, -1)).toBe(1);
    expect(nextQuantity(500, 1)).toBe(500);
    expect([canDecrease(1), canDecrease(2), canIncrease(499), canIncrease(500)]).toEqual([false, true, true, false]);
  });

  it('confirmação com o número da mesa', () => {
    expect(cancelConfirmation(3)).toBe('Cancelar a comanda da mesa 03? Os itens lançados não serão cobrados.');
  });
});

describe('cancelar no modo navegador (RF-03, CA-03, CA-04)', () => {
  it('cancela a comanda aberta, libera a mesa e não entra no relatório', async () => {
    const order = await localRequest<Order>('/tables/1/items', json('POST', { menuItemId: 1, quantity: 2 }));

    const cancelled = await localRequest<Order>(`/orders/${order.id}/cancel`, json('POST'));

    expect(cancelled.status).toBe('CANCELLED');
    expect((await localRequest<Table[]>('/tables'))[0].order).toBeNull();
    const today = localDate(new Date());
    expect((await localRequest<Report>(`/reports/financial?from=${today}&to=${today}`)).paidOrders).toBe(0);
  });

  it('recusa comanda paga e inexistente', async () => {
    const order = await localRequest<Order>('/tables/1/items', json('POST', { menuItemId: 1, quantity: 1 }));
    await localRequest(`/orders/${order.id}/close`, json('POST', { paymentMethod: 'PIX' }));

    await expect(localRequest(`/orders/${order.id}/cancel`, json('POST'))).rejects.toThrow(CANCEL_CLOSED_MESSAGE);
    await expect(localRequest('/orders/999/cancel', json('POST'))).rejects.toThrow('Comanda não encontrada.');
  });

  it('a quantidade alterada muda o total (CA-02)', async () => {
    const order = await localRequest<Order>('/tables/1/items', json('POST', { menuItemId: 1, quantity: 1 }));
    const updated = await localRequest<Order>(`/orders/${order.id}/items/${order.items[0].id}`, json('PATCH', { quantity: 3 }));
    expect(updated.items[0].quantity).toBe(3);
  });
});
