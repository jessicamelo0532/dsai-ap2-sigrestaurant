// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api'; });

import { OpcoesPanel } from './opcoes-panel';
import { EscolherOpcoes } from './escolher-opcoes';
import { setMode } from '@/lib/store';
import type { MenuOptions } from '@/lib/opcoes';
import type { MenuItem } from '@/lib/types';

// SPEC/2026-11-17-tela-de-variacoes-e-adicionais.md (T-02 e T-03)

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

const menu: MenuItem[] = [
  { id: 7, name: 'Pizza', description: null, category: 'Pratos', price: '30.00', available: true },
  { id: 8, name: 'Suco', description: null, category: 'Bebidas', price: '9.00', available: true },
];
const empty: MenuOptions = { menuItemId: 7, variants: [], addons: [] };
const pizza: MenuOptions = {
  menuItemId: 7,
  variants: [{ id: 1, name: 'Média', price: '40.00' }, { id: 2, name: 'Grande', price: '55.00' }],
  addons: [{ id: 5, name: 'Borda', price: '8.00' }],
};
const flat = (node: HTMLElement) => (node.textContent ?? '').replace(/\s/g, ' ');

beforeEach(() => { window.localStorage.clear(); setMode('api'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); setMode('api'); });

describe('aba Opções (CA-01 a CA-03)', () => {
  it('no modo navegador avisa que precisa do servidor', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<OpcoesPanel mode="local" canConnect onConnect={() => {}} menu={menu} />);
    expect(screen.getByText('Variações e adicionais precisam do servidor')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cadastra variações na ordem e adicional, e salva', async () => {
    const calls = stubApi({
      'GET /menu-items/7/options': () => ({ body: empty }),
      'PUT /menu-items/7/options': () => ({ body: pizza }),
    });
    render(<OpcoesPanel mode="api" canConnect onConnect={() => {}} menu={menu} />);

    fireEvent.change(screen.getByLabelText('Item do cardápio'), { target: { value: '7' } });
    fireEvent.click(await screen.findByRole('button', { name: /Incluir variação/ }));
    fireEvent.click(screen.getByRole('button', { name: /Incluir variação/ }));
    fireEvent.change(screen.getByLabelText('Variações: nome 1'), { target: { value: 'Grande' } });
    fireEvent.change(screen.getByLabelText('Variações: preço 1'), { target: { value: '55' } });
    fireEvent.change(screen.getByLabelText('Variações: nome 2'), { target: { value: 'Média' } });
    fireEvent.change(screen.getByLabelText('Variações: preço 2'), { target: { value: '40,00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Subir Média' }));
    fireEvent.click(screen.getByRole('button', { name: /Incluir adicional/ }));
    fireEvent.change(screen.getByLabelText('Adicionais: nome 1'), { target: { value: 'Borda' } });
    fireEvent.change(screen.getByLabelText('Adicionais: preço 1'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar opções/ }));

    expect((await screen.findByRole('status')).textContent).toBe('Pronto, opções salvas.');
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
      variants: [{ name: 'Média', price: 40 }, { name: 'Grande', price: 55 }],
      addons: [{ name: 'Borda', price: 8 }],
    });
  });

  it('carrega as opções salvas e remove uma', async () => {
    const calls = stubApi({
      'GET /menu-items/7/options': () => ({ body: pizza }),
      'PUT /menu-items/7/options': () => ({ body: { ...pizza, addons: [] } }),
    });
    render(<OpcoesPanel mode="api" canConnect onConnect={() => {}} menu={menu} />);

    fireEvent.change(screen.getByLabelText('Item do cardápio'), { target: { value: '7' } });
    expect(((await screen.findByLabelText('Variações: preço 2')) as HTMLInputElement).value).toBe('55,00');
    fireEvent.click(screen.getByRole('button', { name: 'Remover Borda' }));
    fireEvent.click(screen.getByRole('button', { name: /Salvar opções/ }));

    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    expect((calls.find((c) => c.method === 'PUT')?.body as { addons: unknown[] }).addons).toEqual([]);
  });

  it('recusa variação de preço zero e nome repetido sem enviar', async () => {
    const calls = stubApi({ 'GET /menu-items/7/options': () => ({ body: empty }) });
    render(<OpcoesPanel mode="api" canConnect onConnect={() => {}} menu={menu} />);

    fireEvent.change(screen.getByLabelText('Item do cardápio'), { target: { value: '7' } });
    fireEvent.click(await screen.findByRole('button', { name: /Incluir variação/ }));
    fireEvent.change(screen.getByLabelText('Variações: nome 1'), { target: { value: 'Média' } });
    fireEvent.change(screen.getByLabelText('Variações: preço 1'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar opções/ }));
    expect(screen.getByRole('alert').textContent).toBe('Informe um preço válido para Média.');

    fireEvent.change(screen.getByLabelText('Variações: preço 1'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: /Incluir adicional/ }));
    fireEvent.click(screen.getByRole('button', { name: /Incluir adicional/ }));
    fireEvent.change(screen.getByLabelText('Adicionais: nome 1'), { target: { value: 'Borda' } });
    fireEvent.change(screen.getByLabelText('Adicionais: preço 1'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Adicionais: nome 2'), { target: { value: 'borda' } });
    fireEvent.change(screen.getByLabelText('Adicionais: preço 2'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar opções/ }));
    expect(screen.getByRole('alert').textContent).toBe('A opção borda está repetida.');
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('mostra o erro da API', async () => {
    stubApi({
      'GET /menu-items/7/options': () => ({ body: pizza }),
      'PUT /menu-items/7/options': () => ({ body: { message: 'Item do cardápio não encontrado.' }, status: 404 }),
    });
    render(<OpcoesPanel mode="api" canConnect onConnect={() => {}} menu={menu} />);
    fireEvent.change(screen.getByLabelText('Item do cardápio'), { target: { value: '7' } });
    fireEvent.click(await screen.findByRole('button', { name: /Salvar opções/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Item do cardápio não encontrado.');
  });
});

describe('escolha ao lançar (CA-04 a CA-06)', () => {
  it('item sem opções é lançado direto', async () => {
    const calls = stubApi({
      'GET /menu-items/8/options': () => ({ body: { menuItemId: 8, variants: [], addons: [] } }),
      'POST /tables/3/items': () => ({ body: {} }),
    });
    const onDone = vi.fn();
    render(<EscolherOpcoes item={menu[1]} tableId={3} quantity={1} onDone={onDone} onCancel={() => {}} />);

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('Pronto, item lançado na comanda.'));
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ menuItemId: 8, quantity: 1 });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('com opções, calcula o preço e lança a escolha', async () => {
    const calls = stubApi({
      'GET /menu-items/7/options': () => ({ body: pizza }),
      'POST /tables/3/items': () => ({ body: {} }),
    });
    const onDone = vi.fn();
    render(<EscolherOpcoes item={menu[0]} tableId={3} quantity={2} onDone={onDone} onCancel={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Opções de Pizza' });
    fireEvent.click(within(dialog).getByLabelText(/Grande/));
    fireEvent.click(within(dialog).getByLabelText(/Borda/));
    expect(flat(within(dialog).getByLabelText('Preço da linha'))).toBe('2 × R$ 63,00R$ 126,00');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lançar' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ menuItemId: 7, quantity: 2, variantId: 2, addonIds: [5] });
  });

  it('sem variação, recusa sem enviar', async () => {
    const calls = stubApi({ 'GET /menu-items/7/options': () => ({ body: pizza }) });
    render(<EscolherOpcoes item={menu[0]} tableId={3} quantity={1} onDone={() => {}} onCancel={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Opções de Pizza' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lançar' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('Escolha a variação de Pizza: Média, Grande.');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('erro ao lançar item sem opções aparece e pode fechar', async () => {
    stubApi({
      'GET /menu-items/8/options': () => ({ body: { menuItemId: 8, variants: [], addons: [] } }),
      'POST /tables/3/items': () => ({ body: { message: 'Este item não está disponível no cardápio.' }, status: 400 }),
    });
    const onCancel = vi.fn();
    render(<EscolherOpcoes item={menu[1]} tableId={3} quantity={1} onDone={() => {}} onCancel={onCancel} />);

    expect((await screen.findByRole('alert')).textContent).toBe('Este item não está disponível no cardápio.');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
