// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api'; });

import { GarconsPanel } from './garcons-panel';
import type { Waiter, WaiterReport } from '@/lib/garcons';

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

const team: Waiter[] = [
  { id: 1, name: 'Rui', commissionRate: '10.00', active: false },
  { id: 2, name: 'Bia', commissionRate: '12.50', active: true },
  { id: 3, name: 'Ana', commissionRate: '8.00', active: true },
];

const report: WaiterReport = {
  from: '2026-11-01T00:00:00.000Z', to: '2026-11-18T00:00:00.000Z',
  waiters: [
    { waiterId: 2, name: 'Bia', paidOrders: 3, revenue: '300.00', averageTicket: '100.00', commission: '37.50' },
    { waiterId: null, name: 'Sem garçom', paidOrders: 1, revenue: '50.00', averageTicket: '50.00', commission: '0.00' },
  ],
  totals: { paidOrders: 4, revenue: '350.00', commission: '37.50' },
};

const withTeam = (extra: Record<string, Route> = {}) => stubApi({
  'GET /waiters': () => ({ body: team }),
  'GET /reports/waiters': () => ({ body: report }),
  ...extra,
});

const renderApi = () => render(<GarconsPanel mode="api" canConnect onConnect={() => {}} />);
const text = (value: string) => value.replace(/\s/g, ' ');

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('modo navegador (CA-01)', () => {
  it('avisa que precisa do servidor e não faz requisição', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const onConnect = vi.fn();
    render(<GarconsPanel mode="local" canConnect onConnect={onConnect} />);
    expect(screen.getByText('Garçons precisam do servidor')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Conectar ao servidor/ }));
    expect(onConnect).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('lista (CA-02)', () => {
  it('mostra ativos primeiro com comissão e situação', async () => {
    const calls = withTeam();
    renderApi();
    await screen.findByText('Comissão 12,5%');
    const rows = screen.getAllByRole('listitem').map((item) => item.querySelector('strong')?.textContent);
    expect(rows).toEqual(['Ana', 'Bia', 'Rui']);
    expect(screen.getByText('2 ativos · 1 inativos')).toBeTruthy();
    expect(screen.getAllByText('Inativo')).toHaveLength(1);
    expect(calls.some((c) => c.path === '/waiters?all=true')).toBe(true);
  });
});

describe('cadastro (CA-03, CA-04)', () => {
  it('cadastra com comissão em número', async () => {
    const calls = withTeam({ 'POST /waiters': () => ({ body: { id: 9, name: 'Rui Lima', commissionRate: '12.50', active: true }, status: 201 }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: /Novo garçom/ }));
    fireEvent.change(screen.getByPlaceholderText('Ex.: Rui'), { target: { value: 'Rui Lima' } });
    fireEvent.change(screen.getByLabelText('Comissão (%)'), { target: { value: '12,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Rui Lima', commissionRate: 12.5 });
    expect((await screen.findByRole('status')).textContent).toBe('Rui Lima foi cadastrado.');
  });

  it('sem comissão envia só o nome', async () => {
    const calls = withTeam({ 'POST /waiters': () => ({ body: {}, status: 201 }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: /Novo garçom/ }));
    fireEvent.change(screen.getByPlaceholderText('Ex.: Rui'), { target: { value: 'Caio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Caio' });
  });

  it('recusa comissão acima de 30% sem enviar', async () => {
    const calls = withTeam();
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: /Novo garçom/ }));
    fireEvent.change(screen.getByPlaceholderText('Ex.: Rui'), { target: { value: 'Caio' } });
    fireEvent.change(screen.getByLabelText('Comissão (%)'), { target: { value: '31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/0 a 30%/);
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('mostra a recusa da API para nome repetido', async () => {
    withTeam({ 'POST /waiters': () => ({ body: { message: 'Já existe um garçom chamado Bia.' }, status: 400 }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: /Novo garçom/ }));
    fireEvent.change(screen.getByPlaceholderText('Ex.: Rui'), { target: { value: 'bia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Já existe um garçom chamado Bia.');
  });
});

describe('edição, situação e exclusão (CA-05, CA-06)', () => {
  it('edita enviando só a comissão alterada', async () => {
    const calls = withTeam({ 'PATCH /waiters/2': () => ({ body: { ...team[1], commissionRate: '15.00' } }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Bia' }));
    const rate = screen.getByLabelText('Comissão (%)') as HTMLInputElement;
    expect(rate.value).toBe('12,5');
    fireEvent.change(rate, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ commissionRate: 15 });
  });

  it('desativa um garçom ativo e recarrega a lista', async () => {
    const calls = withTeam({ 'PATCH /waiters/3': () => ({ body: { ...team[2], active: false } }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar Ana' }));
    expect((await screen.findByRole('status')).textContent).toBe('Ana foi desativado.');
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ active: false });
    expect(calls.filter((c) => c.path === '/waiters?all=true')).toHaveLength(2);
  });

  it('reativa um garçom inativo', async () => {
    const calls = withTeam({ 'PATCH /waiters/1': () => ({ body: { ...team[0], active: true } }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: 'Ativar Rui' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ active: true }));
  });

  it('mostra a recusa da API ao excluir garçom com comandas', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    withTeam({ 'DELETE /waiters/2': () => ({ body: { message: 'O garçom tem comandas registradas. Desative em vez de excluir.' }, status: 400 }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir Bia' }));
    expect((await screen.findByRole('alert')).textContent).toBe('O garçom tem comandas registradas. Desative em vez de excluir.');
  });

  it('não exclui sem confirmação', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const calls = withTeam();
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir Bia' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });
});

describe('relatório (CA-07, CA-08)', () => {
  it('mostra vendas e comissão por garçom com totais', async () => {
    withTeam();
    renderApi();
    const table = await screen.findByRole('table', { name: 'Vendas e comissão por garçom' });
    const content = text(table.textContent ?? '');
    expect(content).toContain('Bia');
    expect(content).toContain('Sem garçom');
    expect(content).toContain('3 contas');
    expect(content).toContain('R$ 37,50');
    expect(content).toContain('R$ 350,00');
    expect(content).toContain('4 contas');
  });

  it('consulta o novo período e recusa período invertido', async () => {
    const calls = withTeam();
    renderApi();
    await screen.findByRole('table', { name: 'Vendas e comissão por garçom' });
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-10-31' } });
    fireEvent.click(screen.getByRole('button', { name: /Ver período/ }));
    await waitFor(() => expect(calls.some((c) => c.path === '/reports/waiters?from=2026-10-01&to=2026-10-31')).toBe(true));

    const before = calls.length;
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-11-02' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-11-01' } });
    fireEvent.click(screen.getByRole('button', { name: /Ver período/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/anterior/);
    expect(calls.length).toBe(before);
  });

  it('avisa quando não há vendas no período', async () => {
    withTeam({ 'GET /reports/waiters': () => ({ body: { ...report, waiters: [], totals: { paidOrders: 0, revenue: '0.00', commission: '0.00' } } }) });
    renderApi();
    expect(await screen.findByText('Nenhuma conta paga no período.')).toBeTruthy();
  });
});
