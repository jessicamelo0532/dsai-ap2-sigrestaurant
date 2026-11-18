// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api'; });

import { MetasPanel } from './metas-panel';
import { currentMonth, shiftMonth, type Goal, type GoalProgress, type PeriodComparison } from '@/lib/metas';
import { stubApi, Route } from '@/test/api';
const month = currentMonth();
const goal: Goal = { month, revenue: '50000.00', orders: 400, averageTicket: null };
const goalWindow = { from: `${month}-01T00:00:00.000Z`, to: `${month}-18T00:00:00.000Z` };

const withGoal: GoalProgress = {
  month, goal, window: goalWindow,
  actual: { revenue: '43750.00', orders: 500, averageTicket: '87.50' },
  attainment: { revenue: 87.5, orders: 125, averageTicket: null },
  previous: { window: goalWindow, revenue: '38956.00', orders: 520, averageTicket: '74.92' },
  variation: { revenue: 12.3, orders: -3.8, averageTicket: null },
};
const withoutGoal: GoalProgress = { ...withGoal, goal: null, attainment: { revenue: null, orders: null, averageTicket: null } };

const comparison: PeriodComparison = {
  current: { window: { from: '2026-11-01T00:00:00.000Z', to: '2026-11-08T00:00:00.000Z' }, revenue: '9000.00', orders: 100, averageTicket: '90.00' },
  previous: { window: { from: '2026-10-25T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' }, revenue: '8000.00', orders: 100, averageTicket: '80.00' },
  variation: { revenue: 12.5, orders: 0, averageTicket: 12.5 },
};

const api = (progress: GoalProgress, extra: Record<string, Route> = {}) => stubApi({
  'GET /goals/:m/progress': () => ({ body: progress }),
  'GET /goals': () => ({ body: progress.goal ? [progress.goal] : [] }),
  'GET /reports/compare': () => ({ body: comparison }),
  ...extra,
});

const renderApi = () => render(<MetasPanel mode="api" canConnect onConnect={() => {}} />);
const flat = (node: HTMLElement) => (node.textContent ?? '').replace(/\s/g, ' ');

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('modo navegador (CA-01)', () => {
  it('avisa que precisa do servidor e não faz requisição', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<MetasPanel mode="local" canConnect={false} onConnect={() => {}} />);
    expect(screen.getByText('As metas precisam do servidor')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('progresso (CA-02, CA-03)', () => {
  it('mostra realizado, meta, atingimento e variação', async () => {
    api(withGoal);
    renderApi();
    const revenue = await screen.findByRole('article', { name: 'Receita' });
    expect(flat(revenue)).toContain('R$ 43.750,00');
    expect(flat(revenue)).toContain('R$ 50.000,00');
    expect(flat(revenue)).toContain('87,5% da meta');
    expect(flat(revenue)).toContain('+12,3% vs. mês anterior');
    const orders = screen.getByRole('article', { name: 'Comandas' });
    expect(flat(orders)).toContain('125,0% da meta');
    expect(flat(orders)).toContain('−3,8%');
    expect(within(orders).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    const ticket = screen.getByRole('article', { name: 'Ticket médio' });
    expect(flat(ticket)).toContain('sem meta');
    expect(flat(ticket)).toContain('sem base');
  });

  it('sem meta oferece definir', async () => {
    api(withoutGoal);
    renderApi();
    expect(await screen.findByRole('button', { name: /Definir meta/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Remover meta/ })).toBeNull();
  });
});

describe('definir e remover (CA-04, CA-05)', () => {
  it('envia null nos campos vazios', async () => {
    const calls = api(withoutGoal, { 'PUT /goals/:m': () => ({ body: goal }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: /Definir meta/ }));
    fireEvent.change(screen.getByLabelText('Receita (R$)'), { target: { value: '50.000,00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.path).toBe(`/goals/${month}`);
    expect(put?.body).toEqual({ revenue: 50000, orders: null, averageTicket: null });
    expect((await screen.findByRole('status')).textContent).toMatch(/Meta de .* salva\./);
  });

  it('recusa tudo vazio sem enviar', async () => {
    const calls = api(withoutGoal);
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: /Definir meta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Informe pelo menos uma meta: receita, comandas ou ticket médio.');
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('alterar preenche com a meta atual', async () => {
    api(withGoal);
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: /Alterar meta/ }));
    expect((screen.getByLabelText('Receita (R$)') as HTMLInputElement).value).toBe('50.000,00');
    expect((screen.getByLabelText('Comandas pagas') as HTMLInputElement).value).toBe('400');
  });

  it('remove depois de confirmar e recarrega', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const calls = api(withGoal, { 'DELETE /goals/:m': () => ({ body: { success: true } }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: /Remover meta/ }));
    expect((await screen.findByRole('status')).textContent).toBe('Meta removida.');
    expect(calls.find((c) => c.method === 'DELETE')?.path).toBe(`/goals/${month}`);
    expect(calls.filter((c) => c.path.endsWith('/progress'))).toHaveLength(2);
  });
});

describe('meses (CA-06)', () => {
  it('vai ao mês anterior e pede o progresso dele', async () => {
    const calls = api(withGoal);
    renderApi();
    await screen.findByRole('article', { name: 'Receita' });
    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
    await waitFor(() => expect(calls.some((c) => c.path === `/goals/${shiftMonth(month, -1)}/progress`)).toBe(true));
  });

  it('seleciona o mês pela lista do ano', async () => {
    const other = shiftMonth(month, -1);
    const calls = api(withGoal, { 'GET /goals': () => ({ body: [{ ...goal, month: other }, goal] }) });
    renderApi();
    const list = await screen.findByText(`Metas de ${month.slice(0, 4)}`);
    const buttons = within(list.parentElement as HTMLElement).getAllByRole('button');
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(calls.some((c) => c.path === `/goals/${other}/progress`)).toBe(true));
  });
});

describe('comparativo (CA-07)', () => {
  it('mostra os dois períodos e a variação', async () => {
    const calls = api(withGoal);
    renderApi();
    await screen.findByRole('article', { name: 'Receita' });
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-11-07' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comparar' }));
    const table = await screen.findByRole('table', { name: 'Comparativo de períodos' });
    expect(flat(table)).toContain('01/11 a 07/11');
    expect(flat(table)).toContain('25/10 a 31/10');
    expect(flat(table)).toContain('R$ 9.000,00');
    expect(flat(table)).toContain('+12,5%');
    expect(calls.some((c) => c.path === '/reports/compare?from=2026-11-01&to=2026-11-07')).toBe(true);
  });

  it('recusa período invertido sem chamar', async () => {
    const calls = api(withGoal);
    renderApi();
    await screen.findByRole('article', { name: 'Receita' });
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-11-08' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-11-07' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comparar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/anterior/);
    expect(calls.some((c) => c.path.startsWith('/reports/compare'))).toBe(false);
  });

  it('mostra erro da API ao carregar', async () => {
    stubApi({ 'GET /goals/:m/progress': () => ({ body: { message: 'Informe o mês no formato AAAA-MM.' }, status: 400 }), 'GET /goals': () => ({ body: [] }) });
    renderApi();
    expect((await screen.findByRole('alert')).textContent).toBe('Informe o mês no formato AAAA-MM.');
  });
});
