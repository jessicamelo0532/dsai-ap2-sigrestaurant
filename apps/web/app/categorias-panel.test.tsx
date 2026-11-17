// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api';
});

import { CategoriasPanel } from './categorias-panel';
import type { MenuCategory } from '@/lib/categorias';

const reply = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
}) as unknown as Response;

type Answer = { body?: unknown; status?: number };
type Route = (init?: RequestInit) => Answer;

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

const base: MenuCategory[] = [
  { id: 1, name: 'Entradas', sortOrder: 0, itemCount: 1 },
  { id: 2, name: 'Pratos principais', sortOrder: 1, itemCount: 4 },
  { id: 3, name: 'Sobremesas', sortOrder: 2, itemCount: 0 },
];

function listRoute(categories: MenuCategory[]): Route {
  return () => ({ body: categories });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('lista de categorias (RF-01)', () => {
  it('mostra o estado vazio', async () => {
    stubApi({ 'GET /menu-categories': listRoute([]) });
    render(<CategoriasPanel mode="api" canConnect onConnect={() => {}} />);

    expect(await screen.findByText('Nenhuma categoria cadastrada ainda.')).toBeTruthy();
    expect(screen.getByText('0 categorias')).toBeTruthy();
  });

  it('mostra as categorias na ordem com a contagem de itens', async () => {
    stubApi({ 'GET /menu-categories': listRoute([...base].reverse()) });
    render(<CategoriasPanel mode="api" canConnect onConnect={() => {}} />);

    expect(await screen.findByText('Entradas')).toBeTruthy();
    const rows = [...document.querySelectorAll('.categoria-row')];
    expect(rows.map((row) => row.querySelector('strong')?.textContent)).toEqual(['Entradas', 'Pratos principais', 'Sobremesas']);
    expect(screen.getByText('1 item')).toBeTruthy();
    expect(screen.getByText('4 itens')).toBeTruthy();
    expect(screen.getByText('3 categorias')).toBeTruthy();
    expect(screen.getByText('5 itens ligados')).toBeTruthy();
    expect(screen.getByText('1 sem itens')).toBeTruthy();
  });

  it('desabilita mover nas pontas (RNF-01)', async () => {
    stubApi({ 'GET /menu-categories': listRoute(base) });
    render(<CategoriasPanel mode="api" canConnect onConnect={() => {}} />);

    await screen.findByText('Entradas');
    expect((screen.getByRole('button', { name: 'Mover Entradas para cima' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Mover Entradas para baixo' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Mover Sobremesas para baixo' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('criar e renomear (RF-02 e RF-03)', () => {
  it('cria a categoria e recarrega a lista', async () => {
    let current = [...base];
    const calls = stubApi({
      'GET /menu-categories': () => ({ body: current }),
      'POST /menu-categories': (init) => {
        const name = JSON.parse(String(init?.body)).name;
        current = [...current, { id: 9, name, sortOrder: 3, itemCount: 0 }];
        return { body: current[3] };
      },
    });
    render(<CategoriasPanel mode="api" canConnect onConnect={() => {}} />);

    fireEvent.change(await screen.findByPlaceholderText('Ex.: Sobremesas'), { target: { value: '  Bebidas   geladas ' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar/ }));

    await waitFor(() => expect(screen.getByText('Bebidas geladas')).toBeTruthy());
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toEqual({ name: 'Bebidas geladas' });
    expect(screen.getByText('Pronto, categoria criada.')).toBeTruthy();
  });

  it('bloqueia nome curto antes de chamar a API', async () => {
    const calls = stubApi({ 'GET /menu-categories': listRoute(base) });
    render(<CategoriasPanel mode="api" canConnect onConnect={() => {}} />);

    fireEvent.change(await screen.findByPlaceholderText('Ex.: Sobremesas'), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar/ }));

    expect(await screen.findByText('Informe o nome da categoria, de 2 a 50 caracteres.')).toBeTruthy();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('bloqueia nome repetido sem diferenciar acento e maiúscula', async () => {
    const calls = stubApi({ 'GET /menu-categories': listRoute(base) });
    render(<CategoriasPanel mode="api" canConnect onConnect={() => {}} />);

    fireEvent.change(await screen.findByPlaceholderText('Ex.: Sobremesas'), { target: { value: 'sobremesas' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar/ }));

    expect(await screen.findByText('Já existe uma categoria com esse nome.')).toBeTruthy();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('renomeia a categoria e avisa a tela para recarregar o cardápio', async () => {
    const onChanged = vi.fn();
    const calls = stubApi({
      'GET /menu-categories': listRoute(base),
      'PATCH /menu-categories/3': () => ({ body: { id: 3, name: 'Doces', sortOrder: 2 } }),
    });
    render(<CategoriasPanel mode="api" canConnect onConnect={() => {}} onChanged={onChanged} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Renomear Sobremesas' }));
    const input = screen.getByLabelText('Novo nome para Sobremesas');
    fireEvent.change(input, { target: { value: 'Doces' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(calls.some((call) => call.method === 'PATCH' && call.path === '/menu-categories/3')).toBe(true));
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ name: 'Doces' });
    expect(screen.getByText('Pronto, categoria renomeada.')).toBeTruthy();
    expect(onChanged).toHaveBeenCalled();
  });
});

describe('ordem (RF-04)', () => {
  it('envia a lista completa com a categoria deslocada', async () => {
    const calls = stubApi({
      'GET /menu-categories': listRoute(base),
      'PUT /menu-categories/order': () => ({ body: base }),
    });
    render(<CategoriasPanel mode="api" canConnect onConnect={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Mover Pratos principais para cima' }));

    await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true));
    const put = calls.find((call) => call.method === 'PUT');
    expect(put?.path).toBe('/menu-categories/order');
    expect(put?.body).toEqual({ ids: [2, 1, 3] });
    expect(screen.getByText('Pronto, ordem atualizada.')).toBeTruthy();
  });
});

describe('apagar (RF-05)', () => {
  it('só habilita o apagar quando a categoria está sem itens', async () => {
    stubApi({ 'GET /menu-categories': listRoute(base) });
    render(<CategoriasPanel mode="api" canConnect onConnect={() => {}} />);

    await screen.findByText('Entradas');
    expect((screen.getByRole('button', { name: 'Apagar Entradas' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Apagar Sobremesas' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('apaga a categoria vazia', async () => {
    const calls = stubApi({
      'GET /menu-categories': listRoute(base),
      'DELETE /menu-categories/3': () => ({ body: { success: true } }),
    });
    render(<CategoriasPanel mode="api" canConnect onConnect={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Apagar Sobremesas' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE')).toBe(true));
    expect(screen.getByText('Pronto, categoria apagada.')).toBeTruthy();
  });

  it('mostra a recusa da API na tela', async () => {
    stubApi({
      'GET /menu-categories': listRoute(base),
      'DELETE /menu-categories/3': () => ({ status: 400, body: { message: 'Esta categoria tem 2 itens. Mova os itens antes de apagá-la.' } }),
    });
    render(<CategoriasPanel mode="api" canConnect onConnect={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Apagar Sobremesas' }));
    expect(await screen.findByText('Esta categoria tem 2 itens. Mova os itens antes de apagá-la.')).toBeTruthy();
  });
});

describe('importar dos itens (RF-06)', () => {
  it('informa quantas categorias e itens a importação tratou', async () => {
    const calls = stubApi({
      'GET /menu-categories': listRoute(base),
      'POST /menu-categories/import': () => ({ body: { created: ['Bebidas', 'Lanches'], linkedItems: 3 } }),
    });
    render(<CategoriasPanel mode="api" canConnect onConnect={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: /Importar dos itens/ }));
    expect(await screen.findByText('Importação concluída: 2 categorias criadas e 3 itens ligados.')).toBeTruthy();
    expect(calls.find((call) => call.method === 'POST')?.path).toBe('/menu-categories/import');
  });

  it('avisa quando não havia nada para importar', async () => {
    stubApi({
      'GET /menu-categories': listRoute(base),
      'POST /menu-categories/import': () => ({ body: { created: [], linkedItems: 0 } }),
    });
    render(<CategoriasPanel mode="api" canConnect onConnect={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: /Importar dos itens/ }));
    expect(await screen.findByText('Nada para importar: os itens já estão em categorias cadastradas.')).toBeTruthy();
  });
});

describe('modo navegador (RF-08)', () => {
  it('explica que categorias precisam do servidor e não chama a API', () => {
    const calls = stubApi({});
    render(<CategoriasPanel mode="local" canConnect onConnect={() => {}} />);

    expect(screen.getByText('Categorias precisam do servidor')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Conectar ao servidor/ })).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});
