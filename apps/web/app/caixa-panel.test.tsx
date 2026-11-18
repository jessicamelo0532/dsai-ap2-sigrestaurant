// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api'; });

import { CaixaPanel } from './caixa-panel';
import type { CashSession } from '@/lib/caixa';
import { stubApi, Route } from '@/test/api';
const open: CashSession = {
  id: 7, status: 'OPEN', openedBy: 'Ana', openedAt: '2026-11-17T12:00:00.000Z', openingAmount: '150.00',
  closedBy: null, closedAt: null,
  sales: { CASH: '100.00', CREDIT: '80.50', DEBIT: '0.00', PIX: '45.00' },
  movements: [
    { id: 1, type: 'WITHDRAWAL', amount: '40.00', reason: 'Depósito no banco', createdAt: '2026-11-17T14:00:00.000Z' },
    { id: 2, type: 'DEPOSIT', amount: '20.00', reason: 'Troco extra', createdAt: '2026-11-17T15:00:00.000Z' },
  ],
  expected: { CASH: '230.00', CREDIT: '80.50', DEBIT: '0.00', PIX: '45.00' },
  counted: null, differences: null, divergent: false, notes: null,
};

const closedDivergent: CashSession = {
  ...open, id: 6, status: 'CLOSED', openedBy: 'Bia', closedBy: 'Bia', closedAt: '2026-11-16T23:00:00.000Z',
  movements: [], counted: { CASH: '220.00', CREDIT: '80.50', DEBIT: '0.00', PIX: '45.00' },
  differences: [
    { method: 'CASH', expected: '230.00', counted: '220.00', difference: '-10.00' },
    { method: 'CREDIT', expected: '80.50', counted: '80.50', difference: '0.00' },
    { method: 'DEBIT', expected: '0.00', counted: '0.00', difference: '0.00' },
    { method: 'PIX', expected: '45.00', counted: '45.00', difference: '0.00' },
  ],
  divergent: true, notes: 'Troco dado errado',
};

const withOpen = (extra: Record<string, Route> = {}) => stubApi({
  'GET /cash/current': () => ({ body: open }),
  'GET /cash/sessions': () => ({ body: [open, closedDivergent] }),
  ...extra,
});

const renderApi = () => render(<CaixaPanel mode="api" canConnect onConnect={() => {}} />);

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('modo navegador (CA-01)', () => {
  it('avisa que precisa do servidor e não faz requisição', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const onConnect = vi.fn();
    render(<CaixaPanel mode="local" canConnect onConnect={onConnect} />);
    expect(screen.getByText('O caixa precisa do servidor')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Conectar ao servidor/ }));
    expect(onConnect).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sem endereço de API, explica a configuração', () => {
    render(<CaixaPanel mode="local" canConnect={false} onConnect={() => {}} />);
    expect(screen.getByText('NEXT_PUBLIC_API_URL')).toBeTruthy();
  });
});

describe('abertura (CA-02)', () => {
  it('abre o turno com operador e troco em número', async () => {
    let current: CashSession | null = null;
    const calls = stubApi({
      'GET /cash/current': () => ({ body: current }),
      'GET /cash/sessions': () => ({ body: [] }),
      'POST /cash/open': () => { current = open; return { body: open, status: 201 }; },
    });
    renderApi();
    fireEvent.change(await screen.findByPlaceholderText('Ex.: Ana'), { target: { value: ' Ana ' } });
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '150,00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir turno' }));
    expect(await screen.findByText('Turno de Ana')).toBeTruthy();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ operator: 'Ana', openingAmount: 150 });
    expect(screen.getByRole('status').textContent).toMatch(/Turno aberto por Ana/);
  });

  it('não envia com operador curto', async () => {
    const calls = stubApi({ 'GET /cash/current': () => ({ body: null }), 'GET /cash/sessions': () => ({ body: [] }) });
    renderApi();
    fireEvent.change(await screen.findByPlaceholderText('Ex.: Ana'), { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir turno' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/operador/);
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});

describe('turno aberto (CA-03, CA-04, CA-08)', () => {
  it('mostra vendas, esperado e movimentações', async () => {
    withOpen();
    renderApi();
    expect(await screen.findByText('Turno de Ana')).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Esperado por forma de pagamento' });
    expect(table.textContent).toContain('R$ 230,00');
    expect(table.textContent).toContain('R$ 80,50');
    expect(table.textContent).toContain('R$ 355,50');
    expect(screen.getByText('Depósito no banco')).toBeTruthy();
    expect(screen.getByText('Troco extra')).toBeTruthy();
  });

  it('registra sangria com valor e motivo', async () => {
    const calls = withOpen({ 'POST /cash/withdrawals': () => ({ body: open, status: 201 }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: 'Sangria' }));
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '50,25' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Depósito no banco' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar sangria' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/cash/withdrawals')).toBe(true));
    expect(calls.find((c) => c.path === '/cash/withdrawals')?.body).toEqual({ amount: 50.25, reason: 'Depósito no banco' });
    expect((await screen.findByRole('status')).textContent).toBe('Sangria registrada.');
  });

  it('recusa reforço com motivo curto sem enviar', async () => {
    const calls = withOpen();
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: 'Reforço' }));
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'ok' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar reforço' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/motivo do reforço/);
    expect(calls.some((c) => c.path === '/cash/deposits')).toBe(false);
  });

  it('mostra a mensagem da API quando a sangria passa do dinheiro', async () => {
    withOpen({ 'POST /cash/withdrawals': () => ({ body: { message: 'Saldo insuficiente no caixa: há R$ 230,00 em dinheiro.' }, status: 400 }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: 'Sangria' }));
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '999' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Banco' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar sangria' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Saldo insuficiente no caixa: há R$ 230,00 em dinheiro.');
  });
});

describe('fechamento (CA-05, CA-06)', () => {
  async function openCloseForm() {
    fireEvent.click(await screen.findByRole('button', { name: 'Fechar turno' }));
    fireEvent.change(screen.getByPlaceholderText('Quem está fechando'), { target: { value: 'Ana' } });
  }
  const count = (method: string, value: string) => fireEvent.change(screen.getByLabelText(`Contado em ${method}`), { target: { value } });

  it('fecha sem observação quando tudo confere', async () => {
    const calls = withOpen({ 'POST /cash/close': () => ({ body: { ...open, status: 'CLOSED' }, status: 201 }) });
    renderApi();
    await openCloseForm();
    count('Dinheiro', '230'); count('Crédito', '80,50'); count('Pix', '45');
    expect(screen.getAllByText('Confere')).toHaveLength(4);
    fireEvent.click(screen.getAllByRole('button', { name: 'Fechar turno' }).at(-1)!);
    await waitFor(() => expect(calls.some((c) => c.path === '/cash/close')).toBe(true));
    expect(calls.find((c) => c.path === '/cash/close')?.body).toEqual({ operator: 'Ana', counted: { CASH: 230, CREDIT: 80.5, DEBIT: 0, PIX: 45 } });
    expect((await screen.findByRole('status')).textContent).toBe('Turno fechado sem diferença.');
  });

  it('mostra a falta e exige observação antes de enviar', async () => {
    const calls = withOpen({ 'POST /cash/close': () => ({ body: closedDivergent, status: 201 }) });
    renderApi();
    await openCloseForm();
    count('Dinheiro', '220'); count('Crédito', '80,50'); count('Pix', '45');
    expect(screen.getByText('Falta de R$ 10,00')).toBeTruthy();
    expect(screen.getByText(/obrigatória/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Fechar turno' }).at(-1)!);
    expect((await screen.findByRole('alert')).textContent).toBe('Explique a diferença de caixa antes de fechar o turno.');
    expect(calls.some((c) => c.path === '/cash/close')).toBe(false);

    fireEvent.change(screen.getByRole('textbox', { name: /Observação/ }), { target: { value: 'Troco dado errado' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Fechar turno' }).at(-1)!);
    await waitFor(() => expect(calls.some((c) => c.path === '/cash/close')).toBe(true));
    expect((calls.find((c) => c.path === '/cash/close')?.body as { notes: string }).notes).toBe('Troco dado errado');
    expect((await screen.findByRole('status')).textContent).toBe('Turno fechado com diferença registrada.');
  });
});

describe('histórico (CA-07)', () => {
  it('lista os turnos com a diferença dos fechados', async () => {
    const calls = withOpen();
    renderApi();
    expect(await screen.findByText('Fechado com diferença')).toBeTruthy();
    expect(screen.getByText('Bia')).toBeTruthy();
    expect(screen.getByText('Dinheiro: Falta de R$ 10,00')).toBeTruthy();
    expect(calls.find((c) => c.path.startsWith('/cash/sessions'))?.path).toMatch(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
  });

  it('mostra erro de carregamento', async () => {
    stubApi({ 'GET /cash/current': () => ({ body: { message: 'Falha no banco' }, status: 500 }), 'GET /cash/sessions': () => ({ body: [] }) });
    renderApi();
    expect((await screen.findByRole('alert')).textContent).toBe('Falha no banco');
  });
});
