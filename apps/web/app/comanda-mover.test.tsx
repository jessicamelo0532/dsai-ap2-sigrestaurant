// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api'; });

import { ComandaMover } from './comanda-mover';
import { setMode } from '@/lib/store';
import type { OrderEvent } from '@/lib/mover';
import type { Order, Table } from '@/lib/types';

// SPEC/2026-11-17-mover-e-juntar-na-tela.md (T-03)
import { stubApi, Route } from '@/test/api';
const order = (id: number, tableNumber: number): Order => ({
  id, tableNumber, status: 'OPEN', openedAt: '2026-11-17T12:00:00.000Z',
  items: [{ id: 1, menuItemId: 1, nameSnapshot: 'Açaí', unitPrice: '18.00', quantity: 1 }],
});

const current = order(10, 1);
const tables: Table[] = [
  { id: 1, number: 1, capacity: 4, order: current },
  { id: 2, number: 2, capacity: 2, order: null },
  { id: 3, number: 3, capacity: 6, order: order(30, 3) },
  { id: 4, number: 4, capacity: 4, order: null },
];

const events: OrderEvent[] = [
  { id: 1, orderId: 10, type: 'TRANSFER', fromTableNumber: 5, toTableNumber: 1, sourceOrderId: null, reason: 'Ar-condicionado', createdAt: '2026-11-17T12:10:00.000Z' },
  { id: 2, orderId: 10, type: 'MERGE', fromTableNumber: 6, toTableNumber: 1, sourceOrderId: 22, reason: 'Mesmo grupo', createdAt: '2026-11-17T12:20:00.000Z' },
];

const routes = (extra: Record<string, Route> = {}) => stubApi({
  'GET /orders/10/history': () => ({ body: [] }),
  'POST /orders/10/transfer': () => ({ body: { ...current, tableNumber: 2 } }),
  'POST /orders/10/merge': () => ({ body: current }),
  ...extra,
});

beforeEach(() => { window.localStorage.clear(); setMode('api'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); setMode('api'); });

describe('transferir (CA-01, CA-03, CA-06)', () => {
  it('oferece só mesas livres e transfere com o motivo', async () => {
    const calls = routes();
    const onMoved = vi.fn();
    render(<ComandaMover order={current} tableId={1} tables={tables} onMoved={onMoved} />);

    fireEvent.click(screen.getByRole('button', { name: /Transferir mesa/ }));
    const select = screen.getByLabelText('Mesa de destino') as HTMLSelectElement;
    expect([...select.options].map((option) => option.textContent)).toEqual(['Mesa 02 · 2 lugares', 'Mesa 04 · 4 lugares']);
    fireEvent.change(select, { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: '  Cliente pediu   janela ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Transferir' }));

    await waitFor(() => expect(onMoved).toHaveBeenCalledWith(4));
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ tableId: 4, reason: 'Cliente pediu janela' });
    expect(screen.getByRole('status').textContent).toBe('Comanda transferida para a mesa 04.');
  });

  it('recusa motivo curto sem enviar', async () => {
    const calls = routes();
    render(<ComandaMover order={current} tableId={1} tables={tables} onMoved={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Transferir mesa/ }));
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'ok' } });
    fireEvent.click(screen.getByRole('button', { name: 'Transferir' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Informe o motivo, de 3 a 200 caracteres.');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('sem mesa livre, o botão fica indisponível', async () => {
    routes();
    const full = tables.map((table) => ({ ...table, order: table.order ?? order(90 + table.id, table.number) }));
    render(<ComandaMover order={current} tableId={1} tables={full} onMoved={() => {}} />);

    expect((screen.getByRole('button', { name: /Transferir mesa/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Nenhuma mesa livre para transferir.')).toBeTruthy();
  });
});

describe('juntar (CA-02)', () => {
  it('traz a conta de outra mesa', async () => {
    const calls = routes();
    const onMoved = vi.fn();
    render(<ComandaMover order={current} tableId={1} tables={tables} onMoved={onMoved} />);

    fireEvent.click(screen.getByRole('button', { name: /Juntar contas/ }));
    expect((screen.getByLabelText('Trazer a conta da') as HTMLSelectElement).options[0].textContent).toBe('Mesa 03 · comanda #30');
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Mesmo grupo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Juntar nesta conta' }));

    await waitFor(() => expect(onMoved).toHaveBeenCalledWith(1));
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({ path: '/orders/10/merge', body: { sourceOrderId: 30, reason: 'Mesmo grupo' } });
    expect(screen.getByRole('status').textContent).toBe('Conta da mesa 03 juntada a esta.');
  });

  it('mostra o erro da API', async () => {
    routes({ 'POST /orders/10/merge': () => ({ body: { message: 'Só comandas abertas podem ser juntadas.' }, status: 400 }) });
    render(<ComandaMover order={current} tableId={1} tables={tables} onMoved={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Juntar contas/ }));
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Mesmo grupo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Juntar nesta conta' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Só comandas abertas podem ser juntadas.');
  });

  it('sem outra conta aberta, juntar fica indisponível', () => {
    routes();
    render(<ComandaMover order={current} tableId={1} tables={tables.filter((table) => table.id !== 3)} onMoved={() => {}} />);

    expect((screen.getByRole('button', { name: /Juntar contas/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('histórico (CA-05)', () => {
  it('mostra os eventos com motivo', async () => {
    routes({ 'GET /orders/10/history': () => ({ body: [events[1], events[0]] }) });
    render(<ComandaMover order={current} tableId={1} tables={tables} onMoved={() => {}} />);

    const list = await screen.findByRole('list', { name: 'Histórico da comanda' });
    const items = within(list).getAllByRole('listitem');
    expect(items[0].textContent).toContain('Transferida da mesa 05 para a mesa 01');
    expect(items[0].textContent).toContain('Ar-condicionado');
    expect(items[1].textContent).toContain('Recebeu a comanda #22 da mesa 06');
  });

  it('sem eventos, não mostra o histórico', async () => {
    const calls = routes();
    render(<ComandaMover order={current} tableId={1} tables={tables} onMoved={() => {}} />);

    await waitFor(() => expect(calls.some((c) => c.path === '/orders/10/history')).toBe(true));
    expect(screen.queryByRole('list', { name: 'Histórico da comanda' })).toBeNull();
  });
});
