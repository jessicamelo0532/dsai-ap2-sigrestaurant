// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api'; });

import { SalaoPanel } from './salao-panel';
import { setMode } from '@/lib/store';
import type { Table } from '@/lib/types';
import type { Zone } from '@/lib/zonas';

// SPEC/2026-11-17-zonas-do-salao.md (T-06): tela Salão com zonas e janela Zonas.

const reply = (body: unknown, status = 200) => ({
  ok: status < 400, status, text: async () => (body === undefined ? '' : JSON.stringify(body)),
}) as unknown as Response;

type Route = (init?: RequestInit) => { body?: unknown; status?: number };
function stubApi(routes: Record<string, Route>) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace('http://api.test/api', '');
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const handler = routes[`${method} ${path.split('?')[0]}`];
    if (!handler) return reply({ message: `sem rota ${method} ${path}` }, 404);
    const answer = handler(init);
    return reply(answer.body, answer.status);
  }));
  return calls;
}

const zones: Zone[] = [
  { id: 1, name: 'Salão', sortOrder: 1, tableCount: 2 },
  { id: 2, name: 'Varanda', sortOrder: 2, tableCount: 1 },
];

const order = (id: number, tableNumber: number) => ({
  id, tableNumber, status: 'OPEN' as const, openedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
  items: [{ id: 1, menuItemId: 1, nameSnapshot: 'Açaí', unitPrice: '18.00', quantity: 1 }],
});

const tables: Table[] = [
  { id: 1, number: 1, capacity: 4, zoneId: 1, order: order(10, 1) },
  { id: 2, number: 2, capacity: 2, zoneId: 1, order: null },
  { id: 3, number: 3, capacity: 6, zoneId: 2, order: null },
];

const panel = (onRefresh = () => {}) => render(<SalaoPanel tables={tables} onOpenTable={() => {}} onRefresh={onRefresh} />);

beforeEach(() => { window.localStorage.clear(); setMode('api'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); setMode('api'); });

describe('salão por zona (RF-07, CA-07)', () => {
  it('um grupo por zona com ocupação', async () => {
    stubApi({ 'GET /zones': () => ({ body: zones }) });
    panel();

    const salao = await screen.findByRole('region', { name: 'Zona Salão' });
    expect(within(salao).getByText('1 de 2 ocupadas')).toBeTruthy();
    expect(within(salao).getAllByRole('article')).toHaveLength(2);
    const varanda = screen.getByRole('region', { name: 'Zona Varanda' });
    expect(within(varanda).getByText('0 de 1 ocupada')).toBeTruthy();
    expect(within(varanda).getByRole('article', { name: 'Mesa 03, livre' })).toBeTruthy();
  });

  it('o filtro por zona mostra só as mesas daquela zona', async () => {
    stubApi({ 'GET /zones': () => ({ body: zones }) });
    panel();

    fireEvent.click(await screen.findByRole('button', { name: 'Varanda' }));
    expect(screen.queryByRole('region', { name: 'Zona Salão' })).toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Todas as zonas' }));
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('com uma zona só, mostra a grade como antes', async () => {
    stubApi({ 'GET /zones': () => ({ body: [zones[0]] }) });
    panel();

    expect(await screen.findByRole('button', { name: /Zonas/ })).toBeTruthy();
    expect(screen.queryByRole('region', { name: /Zona / })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Filtrar por zona' })).toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('se as zonas não carregam, a tela continua funcionando', async () => {
    stubApi({ 'GET /zones': () => ({ body: { message: 'fora do ar' }, status: 500 }) });
    panel();

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
    expect(screen.queryByRole('button', { name: /Zonas/ })).toBeNull();
  });
});

describe('janela Zonas (RF-08, CA-08)', () => {
  async function openModal(extra: Record<string, Route> = {}, onRefresh = vi.fn()) {
    const calls = stubApi({ 'GET /zones': () => ({ body: zones }), ...extra });
    panel(onRefresh);
    fireEvent.click(await screen.findByRole('button', { name: /^Zonas$/ }));
    return { calls, dialog: screen.getByRole('dialog', { name: 'Zonas do salão' }), onRefresh };
  }

  it('cria zona e recarrega', async () => {
    const { calls, dialog, onRefresh } = await openModal({ 'POST /zones': () => ({ body: { id: 3, name: 'Terraço', sortOrder: 3 }, status: 201 }) });
    fireEvent.change(within(dialog).getByLabelText('Nome da nova zona'), { target: { value: 'Terraço' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Criar zona/ }));

    expect((await within(dialog).findByRole('status')).textContent).toBe('Zona Terraço criada.');
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Terraço' });
    expect(onRefresh).toHaveBeenCalled();
  });

  it('recusa nome repetido sem enviar', async () => {
    const { calls, dialog } = await openModal();
    fireEvent.change(within(dialog).getByLabelText('Nome da nova zona'), { target: { value: 'varanda' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Criar zona/ }));

    expect(within(dialog).getByRole('alert').textContent).toBe('Já existe uma zona chamada Varanda.');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('renomeia', async () => {
    const { calls, dialog } = await openModal({ 'PATCH /zones/2': () => ({ body: { ...zones[1], name: 'Varanda coberta' } }) });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Renomear Varanda' }));
    fireEvent.change(within(dialog).getByLabelText('Novo nome de Varanda'), { target: { value: 'Varanda coberta' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar nome' }));

    expect((await within(dialog).findByRole('status')).textContent).toBe('Zona renomeada.');
    expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ path: '/zones/2', body: { name: 'Varanda coberta' } });
  });

  it('não deixa excluir zona com mesas e exclui a vazia', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const empty: Zone = { id: 4, name: 'Mezanino', sortOrder: 3, tableCount: 0 };
    const calls = stubApi({ 'GET /zones': () => ({ body: [...zones, empty] }), 'DELETE /zones/4': () => ({ body: { success: true } }) });
    panel();
    fireEvent.click(await screen.findByRole('button', { name: /^Zonas$/ }));
    const dialog = screen.getByRole('dialog', { name: 'Zonas do salão' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir Varanda' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('Mova as mesas desta zona antes de excluí-la.');
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir Mezanino' }));
    expect((await within(dialog).findByRole('status')).textContent).toBe('Zona Mezanino excluída.');
  });

  it('move uma mesa de zona', async () => {
    const { calls, dialog } = await openModal({ 'PATCH /tables/2': () => ({ body: { ...tables[1], zoneId: 2 } }) });
    fireEvent.change(within(dialog).getByLabelText('Mesa 02'), { target: { value: '2' } });

    expect((await within(dialog).findByRole('status')).textContent).toBe('Mesa 02 foi para Varanda.');
    expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ path: '/tables/2', body: { zoneId: 2 } });
  });

  it('mostra o erro da API', async () => {
    const { dialog } = await openModal({ 'POST /zones': () => ({ body: { message: 'Já existe uma zona chamada Terraço.' }, status: 400 }) });
    fireEvent.change(within(dialog).getByLabelText('Nome da nova zona'), { target: { value: 'Terraço' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Criar zona/ }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe('Já existe uma zona chamada Terraço.');
  });
});

describe('modo navegador (RF-06)', () => {
  it('cria a zona no localStorage e ela aparece na janela', async () => {
    setMode('local');
    const local: Table[] = [{ id: 1, number: 1, capacity: 2, zoneId: 1, order: null }];
    render(<SalaoPanel tables={local} onOpenTable={() => {}} onRefresh={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Zonas$/ }));
    const dialog = screen.getByRole('dialog', { name: 'Zonas do salão' });

    fireEvent.change(within(dialog).getByLabelText('Nome da nova zona'), { target: { value: 'Varanda' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Criar zona/ }));

    expect((await within(dialog).findByRole('status')).textContent).toBe('Zona Varanda criada.');
    const list = within(dialog).getByRole('list', { name: 'Zonas' });
    expect(await within(list).findByText('Varanda')).toBeTruthy();
  });
});
