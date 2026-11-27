// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api'; });

import { RelatoriosVendasPanel } from './relatorios-vendas';
import { setMode } from '@/lib/store';
import { reportForPeriod, type PaidSale } from '@/lib/sales-report';
import { stubApi } from '@/test/api';

const line = (key: string, name: string, category: string, quantity: number, unitPriceCents: number) => ({
  key, name, category, quantity, unitPriceCents,
});
const sale = (paidAt: string, paymentMethod: PaidSale['paymentMethod'], lines: PaidSale['lines']): PaidSale => ({
  paidAt: new Date(paidAt), paymentMethod, lines,
});

const current = reportForPeriod([
  sale('2026-11-25T13:00:00Z', 'PIX', [line('1|Barato', 'Barato', 'Pratos', 5, 100)]),
  sale('2026-11-25T13:10:00Z', 'CASH', [line('2|Caro', 'Caro', 'Bebidas', 1, 10000)]),
], '2026-11-25', '2026-11-25');

const previous = reportForPeriod([
  sale('2026-11-24T13:00:00Z', 'PIX', [line('1|Barato', 'Barato', 'Pratos', 5, 1000)]),
], '2026-11-24', '2026-11-24');

const empty = reportForPeriod([], '2026-11-25', '2026-11-25');

function mockReports(routes: { current?: unknown; previous?: unknown; status?: number } = {}) {
  return stubApi({
    'GET /reports/sales': (_init, path) => ({
      body: routes.status && routes.status >= 400 ? { message: 'Servidor fora do ar' } : path?.includes('from=2026-11-24') ? routes.previous ?? previous : routes.current ?? current,
      status: routes.status ?? 200,
    }),
  });
}

beforeEach(() => { window.localStorage.clear(); setMode('api'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); setMode('api'); });

// SPEC/2026-11-25-tela-de-relatorios-de-vendas.md (CA-01 a CA-10).
describe('painel de relatórios de vendas', () => {
  it('mostra KPIs e comparativo com o período anterior', async () => {
    mockReports();
    render(<RelatoriosVendasPanel from="2026-11-25" to="2026-11-25" mode="api" />);

    expect(await screen.findByText('O que a casa vendeu')).toBeTruthy();
    expect(screen.getAllByText(/105,00/).length).toBeGreaterThan(0);
    expect(screen.getByText('+110,0%')).toBeTruthy();
    expect(screen.getAllByText('Barato').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Caro').length).toBeGreaterThan(0);
    expect(screen.getByText('Itens vendidos')).toBeTruthy();
    expect(screen.getByText('Receita líquida')).toBeTruthy();
  });

  it('alterna o ranking entre quantidade e receita sem nova consulta', async () => {
    const calls = mockReports();
    render(<RelatoriosVendasPanel from="2026-11-25" to="2026-11-25" mode="api" />);
    await screen.findByRole('table', { name: 'Itens por quantidade' });
    const before = screen.getByRole('table', { name: 'Itens por quantidade' });
    expect(within(before).getAllByRole('row')[1].textContent).toContain('Barato');

    const callsBefore = calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Por receita' }));
    const after = screen.getByRole('table', { name: 'Itens por receita' });
    expect(within(after).getAllByRole('row')[1].textContent).toContain('Caro');
    expect(calls.length).toBe(callsBefore);
  });

  it('muda o limite e refaz a consulta', async () => {
    const calls = mockReports();
    render(<RelatoriosVendasPanel from="2026-11-25" to="2026-11-25" mode="api" />);
    await screen.findByText('O que a casa vendeu');

    fireEvent.change(screen.getByLabelText('Itens no ranking'), { target: { value: '50' } });
    await waitFor(() => expect(calls.some((call) => call.path.includes('limit=50'))).toBe(true));
  });

  it('exporta CSV usando o relatório carregado', async () => {
    mockReports();
    const create = vi.fn(() => 'blob:relatorio');
    Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<RelatoriosVendasPanel from="2026-11-25" to="2026-11-25" mode="api" />);

    await screen.findByText('O que a casa vendeu');
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
  });

  it('mostra estado vazio quando não há venda', async () => {
    mockReports({ current: empty, previous: empty });
    render(<RelatoriosVendasPanel from="2026-11-25" to="2026-11-25" mode="api" />);
    expect(await screen.findByText('Nenhuma venda no período')).toBeTruthy();
  });

  it('mostra sem base quando o período anterior é zero', async () => {
    mockReports({ previous: empty });
    render(<RelatoriosVendasPanel from="2026-11-25" to="2026-11-25" mode="api" />);
    await screen.findByText('O que a casa vendeu');
    expect(screen.getAllByText('sem base').length).toBeGreaterThan(0);
  });

  it('mostra erro e tenta de novo', async () => {
    let fail = true;
    stubApi({
      'GET /reports/sales': () => fail
        ? { body: { message: 'Servidor fora do ar' }, status: 500 }
        : { body: current },
    });
    render(<RelatoriosVendasPanel from="2026-11-25" to="2026-11-25" mode="api" />);
    expect((await screen.findByRole('alert')).textContent).toContain('Servidor fora do ar');

    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('O que a casa vendeu')).toBeTruthy();
  });

  it('abre o comparativo detalhado do período', async () => {
    mockReports();
    render(<RelatoriosVendasPanel from="2026-11-25" to="2026-11-25" mode="api" />);
    await screen.findByText('O que a casa vendeu');

    fireEvent.click(screen.getByRole('tab', { name: 'Comparativo' }));
    expect(await screen.findByText('Comparativo detalhado')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Comparativo de totais' })).toBeTruthy();
  });

  it('abre a prévia de impressão', async () => {
    mockReports();
    render(<RelatoriosVendasPanel from="2026-11-25" to="2026-11-25" mode="api" />);
    await screen.findByText('O que a casa vendeu');

    fireEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    expect(screen.getByRole('dialog', { name: 'Relatório para impressão' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Relatório de vendas' })).toBeTruthy();
  });

  it('valida o período antes de consultar', async () => {
    const calls = mockReports();
    render(<RelatoriosVendasPanel from="2026-11-30" to="2026-11-01" mode="api" />);
    expect((await screen.findByRole('alert')).textContent).toContain('A data inicial deve ser anterior ou igual à data final.');
    expect(calls).toHaveLength(0);
  });
});
