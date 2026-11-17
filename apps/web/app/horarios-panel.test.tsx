// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api'; });

import { HorariosPanel } from './horarios-panel';
import { setMode } from '@/lib/store';
import type { Availability } from '@/lib/horarios';
import type { MenuItem } from '@/lib/types';

// SPEC/2026-11-17-tela-de-horarios-do-cardapio.md (T-02)

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

const menu: MenuItem[] = [{ id: 4, name: 'Prato executivo', description: null, category: 'Almoço', price: '29.90', available: true }];
const always: Availability = { menuItemId: 4, alwaysAvailable: true, availableNow: true, windows: [] };
const lunch: Availability = {
  menuItemId: 4, alwaysAvailable: false, availableNow: false,
  windows: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, day: '', start: '11:00', end: '15:00' })),
};

const choose = () => fireEvent.change(screen.getByLabelText('Item do cardápio'), { target: { value: '4' } });

beforeEach(() => { window.localStorage.clear(); setMode('api'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); setMode('api'); });

describe('aba Horários', () => {
  it('no modo navegador avisa que precisa do servidor (CA-01)', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<HorariosPanel mode="local" canConnect={false} onConnect={() => {}} menu={menu} onChanged={() => {}} />);
    expect(screen.getByText('Horários do cardápio precisam do servidor')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('item sem janelas aparece como sempre disponível (CA-02)', async () => {
    stubApi({ 'GET /menu-items/4/availability': () => ({ body: always }) });
    render(<HorariosPanel mode="api" canConnect onConnect={() => {}} menu={menu} onChanged={() => {}} />);
    choose();
    expect(await screen.findByText('Sempre disponível', { selector: 'p' })).toBeTruthy();
    expect(screen.getByText('Nenhuma janela: o item aparece em qualquer horário.')).toBeTruthy();
  });

  it('inclui segunda 11:00–15:00, repete nos dias úteis e salva em ordem (CA-03)', async () => {
    const calls = stubApi({
      'GET /menu-items/4/availability': () => ({ body: always }),
      'PUT /menu-items/4/availability': () => ({ body: lunch }),
    });
    const onChanged = vi.fn();
    render(<HorariosPanel mode="api" canConnect onConnect={() => {}} menu={menu} onChanged={onChanged} />);
    choose();

    fireEvent.click(await screen.findByRole('button', { name: /Incluir janela/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Repetir a janela 1 nos dias úteis' }));
    expect(within(screen.getByRole('list', { name: 'Janelas de horário' })).getAllByRole('listitem')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: /Salvar horários/ }));

    expect((await screen.findByRole('status')).textContent).toBe('Pronto, horários salvos.');
    expect((calls.find((c) => c.method === 'PUT')?.body as { windows: { weekday: number }[] }).windows.map((w) => w.weekday)).toEqual([1, 2, 3, 4, 5]);
    expect(screen.getByText('Fora do horário agora')).toBeTruthy();
    expect(onChanged).toHaveBeenCalled();
  });

  it('recusa início depois do fim e sobreposição sem enviar (CA-04)', async () => {
    const calls = stubApi({ 'GET /menu-items/4/availability': () => ({ body: always }) });
    render(<HorariosPanel mode="api" canConnect onConnect={() => {}} menu={menu} onChanged={() => {}} />);
    choose();

    fireEvent.click(await screen.findByRole('button', { name: /Incluir janela/ }));
    fireEvent.change(screen.getByLabelText('Início da janela 1'), { target: { value: '15:00' } });
    fireEvent.change(screen.getByLabelText('Fim da janela 1'), { target: { value: '11:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar horários/ }));
    expect(screen.getByRole('alert').textContent).toBe('O horário de início deve ser antes do fim.');

    fireEvent.change(screen.getByLabelText('Início da janela 1'), { target: { value: '11:00' } });
    fireEvent.change(screen.getByLabelText('Fim da janela 1'), { target: { value: '15:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Incluir janela/ }));
    fireEvent.change(screen.getByLabelText('Início da janela 2'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('Fim da janela 2'), { target: { value: '16:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar horários/ }));
    expect(screen.getByRole('alert').textContent).toBe('As janelas de segunda-feira se sobrepõem.');
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('sempre disponível envia a lista vazia (CA-05)', async () => {
    const calls = stubApi({
      'GET /menu-items/4/availability': () => ({ body: lunch }),
      'PUT /menu-items/4/availability': () => ({ body: always }),
    });
    render(<HorariosPanel mode="api" canConnect onConnect={() => {}} menu={menu} onChanged={() => {}} />);
    choose();

    fireEvent.click(await screen.findByRole('button', { name: /Sempre disponível/ }));
    fireEvent.click(screen.getByRole('button', { name: /Salvar horários/ }));

    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ windows: [] }));
    expect((await screen.findByRole('status')).textContent).toBe('Pronto, o item fica sempre disponível.');
  });

  it('remove uma janela', async () => {
    stubApi({ 'GET /menu-items/4/availability': () => ({ body: lunch }) });
    render(<HorariosPanel mode="api" canConnect onConnect={() => {}} menu={menu} onChanged={() => {}} />);
    choose();

    fireEvent.click(await screen.findByRole('button', { name: 'Remover a janela 5' }));
    expect(within(screen.getByRole('list', { name: 'Janelas de horário' })).getAllByRole('listitem')).toHaveLength(4);
  });

  it('mostra o erro da API (CA-06)', async () => {
    stubApi({
      'GET /menu-items/4/availability': () => ({ body: always }),
      'PUT /menu-items/4/availability': () => ({ body: { message: 'Item do cardápio não encontrado.' }, status: 404 }),
    });
    render(<HorariosPanel mode="api" canConnect onConnect={() => {}} menu={menu} onChanged={() => {}} />);
    choose();
    fireEvent.click(await screen.findByRole('button', { name: /Salvar horários/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Item do cardápio não encontrado.');
  });
});
