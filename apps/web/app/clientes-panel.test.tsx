// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api'; });

import { ClientesPanel } from './clientes-panel';
import type { Customer, CustomerHistory } from '@/lib/clientes';

const reply = (body: unknown, status = 200) => ({
  ok: status < 400, status, text: async () => (body === undefined ? '' : JSON.stringify(body)),
}) as unknown as Response;

type Route = (path: string) => { body?: unknown; status?: number };
function stubApi(routes: Record<string, Route>) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace('http://api.test/api', '');
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const handler = routes[`${method} ${path.split('?')[0]}`];
    if (!handler) return reply({ message: `sem rota ${method} ${path}` }, 404);
    const answer = handler(path);
    return reply(answer.body, answer.status);
  }));
  return calls;
}

// Dados fictícios (AGENTS.md §9).
const people: Customer[] = [
  { id: 1, name: 'Ana Souza', phone: '91988887777', notes: 'Sem cebola', active: true },
  { id: 2, name: 'Caio Lima', phone: null, notes: null, active: true },
];
const inactive: Customer = { id: 3, name: 'Duda Reis', phone: '9133334444', notes: null, active: false };

const history: CustomerHistory = {
  customer: people[0], period: null, visits: 3, totalSpent: '240.00', averageTicket: '80.00',
  firstVisit: '2026-10-02T21:00:00.000Z', lastVisit: '2026-11-15T21:00:00.000Z',
  favorites: [{ name: 'Moqueca', quantity: 4 }, { name: 'Açaí', quantity: 2 }],
  orders: [
    { id: 30, paidAt: '2026-11-15T21:00:00.000Z', tableNumber: 4, total: '120.00' },
    { id: 12, paidAt: '2026-10-02T21:00:00.000Z', tableNumber: 7, total: '60.00' },
  ],
};

const withPeople = (extra: Record<string, Route> = {}) => stubApi({
  'GET /customers': (path) => ({ body: path.includes('all=true') ? [...people, inactive] : people }),
  'GET /customers/1/history': () => ({ body: history }),
  ...extra,
});

const renderApi = () => render(<ClientesPanel mode="api" canConnect onConnect={() => {}} />);

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('modo navegador (CA-01)', () => {
  it('avisa que precisa do servidor e não faz requisição', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<ClientesPanel mode="local" canConnect={false} onConnect={() => {}} />);
    expect(screen.getByText('Clientes precisam do servidor')).toBeTruthy();
    expect(screen.getByText('NEXT_PUBLIC_API_URL')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('lista e busca (CA-02, CA-03)', () => {
  it('mostra nome, telefone formatado e observação', async () => {
    withPeople();
    renderApi();
    expect(await screen.findByText('Ana Souza')).toBeTruthy();
    expect(screen.getByText('(91) 98888-7777')).toBeTruthy();
    expect(screen.getByText('Sem cebola')).toBeTruthy();
    expect(screen.getByText('Caio Lima')).toBeTruthy();
  });

  it('busca pela API depois de parar de digitar', async () => {
    const calls = withPeople();
    renderApi();
    await screen.findByText('Ana Souza');
    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'ana' } });
    await waitFor(() => expect(calls.some((c) => c.path === '/customers?search=ana')).toBe(true));
  });

  it('mostra desativados quando marcado', async () => {
    const calls = withPeople();
    renderApi();
    await screen.findByText('Ana Souza');
    fireEvent.click(screen.getByLabelText('Mostrar desativados'));
    expect(await screen.findByText('Duda Reis')).toBeTruthy();
    expect(screen.getByText('Desativado')).toBeTruthy();
    expect(calls.some((c) => c.path === '/customers?all=true')).toBe(true);
  });

  it('avisa quando nada é encontrado', async () => {
    stubApi({ 'GET /customers': () => ({ body: [] }) });
    renderApi();
    expect(await screen.findByText('Nenhum cliente encontrado.')).toBeTruthy();
  });
});

describe('cadastro e edição (CA-04 a CA-06)', () => {
  it('cadastra sem observação vazia', async () => {
    const calls = withPeople({ 'POST /customers': () => ({ body: {}, status: 201 }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: /Novo cliente/ }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Bia Melo' } });
    fireEvent.change(screen.getByLabelText('Telefone com DDD (opcional)'), { target: { value: '(91) 97777-6666' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Bia Melo', phone: '(91) 97777-6666' });
    expect((await screen.findByRole('status')).textContent).toBe('Pronto, cliente cadastrado.');
  });

  it('recusa telefone com 9 dígitos sem enviar', async () => {
    const calls = withPeople();
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: /Novo cliente/ }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Bia' } });
    fireEvent.change(screen.getByLabelText('Telefone com DDD (opcional)'), { target: { value: '97777-666' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Informe o telefone com DDD, com 10 ou 11 dígitos.');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('mostra a recusa da API para cliente duplicado', async () => {
    withPeople({ 'POST /customers': () => ({ body: { message: 'Já existe cliente com esse nome e telefone.' }, status: 400 }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: /Novo cliente/ }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana Souza' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Já existe cliente com esse nome e telefone.');
  });

  it('edita enviando só a observação', async () => {
    const calls = withPeople({ 'PATCH /customers/1': () => ({ body: people[0] }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Ana Souza' }));
    expect((screen.getByLabelText('Telefone com DDD (opcional)') as HTMLInputElement).value).toBe('(91) 98888-7777');
    fireEvent.change(screen.getByLabelText('Observação (opcional)'), { target: { value: 'Sem pimenta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ notes: 'Sem pimenta' });
  });

  it('desativa um cliente', async () => {
    const calls = withPeople({ 'PATCH /customers/2': () => ({ body: { ...people[1], active: false } }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar Caio Lima' }));
    expect((await screen.findByRole('status')).textContent).toBe('Caio Lima foi desativado.');
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ active: false });
  });
});

describe('histórico (CA-07, CA-08)', () => {
  it('mostra visitas, valores, favoritos e comandas', async () => {
    withPeople();
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: 'Histórico de Ana Souza' }));
    const dialog = await screen.findByRole('dialog', { name: 'Histórico de Ana Souza' });
    expect(await within(dialog).findByText('3 visitas')).toBeTruthy();
    const content = (dialog.textContent ?? '').replace(/\s/g, ' ');
    expect(content).toContain('R$ 240,00');
    expect(content).toContain('R$ 80,00');
    expect(content).toContain('Moqueca');
    expect(content).toContain('Mesa 04');
    expect(within(dialog).getByRole('list', { name: 'Comandas pagas' }).children).toHaveLength(2);
  });

  it('filtra por período e recusa período incompleto', async () => {
    const calls = withPeople();
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: 'Histórico de Ana Souza' }));
    const dialog = await screen.findByRole('dialog', { name: 'Histórico de Ana Souza' });
    await within(dialog).findByText('3 visitas');
    fireEvent.change(within(dialog).getByLabelText('De'), { target: { value: '2026-11-01' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Filtrar' }));
    expect((await within(dialog).findByRole('alert')).textContent).toMatch(/duas datas/);
    fireEvent.change(within(dialog).getByLabelText('Até'), { target: { value: '2026-11-17' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Filtrar' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/customers/1/history?from=2026-11-01&to=2026-11-17')).toBe(true));
  });

  it('avisa quando não há comandas pagas', async () => {
    withPeople({ 'GET /customers/1/history': () => ({ body: { ...history, visits: 0, favorites: [], orders: [], firstVisit: null, lastVisit: null } }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: 'Histórico de Ana Souza' }));
    expect(await screen.findByText('Nenhuma comanda paga ainda.')).toBeTruthy();
    expect(screen.getByText('Nenhuma visita')).toBeTruthy();
  });
});
