// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api'; });

import { FidelidadePanel } from './fidelidade-panel';
import type { CustomerLoyalty, LoyaltyRule } from '@/lib/fidelidade';
import { stubApi, Route } from '@/test/api';
const standard: LoyaltyRule = { pointsPerReal: 1, centsPerPoint: 5, minRedeemPoints: 100 };

// Dados fictícios (AGENTS.md §9).
const loyalty: CustomerLoyalty = {
  customerId: 1, balance: 140, balanceValue: '7.00',
  entries: [
    { id: 3, type: 'REFUND', points: 100, orderId: 21, createdAt: '2026-11-15T22:00:00.000Z' },
    { id: 2, type: 'REDEEM', points: -100, orderId: 21, createdAt: '2026-11-15T21:00:00.000Z' },
    { id: 1, type: 'EARN', points: 140, orderId: 12, createdAt: '2026-11-02T21:00:00.000Z' },
  ],
};

const withRule = (extra: Record<string, Route> = {}) => stubApi({
  'GET /loyalty/settings': () => ({ body: standard }),
  'GET /customers': () => ({ body: [{ id: 1, name: 'Ana Souza', phone: '91988887777' }] }),
  'GET /customers/1/loyalty': () => ({ body: loyalty }),
  ...extra,
});

const renderApi = () => render(<FidelidadePanel mode="api" canConnect onConnect={() => {}} />);
const flat = (node: HTMLElement) => (node.textContent ?? '').replace(/\s/g, ' ');

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('modo navegador (CA-01)', () => {
  it('avisa que precisa do servidor e não faz requisição', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const onConnect = vi.fn();
    render(<FidelidadePanel mode="local" canConnect onConnect={onConnect} />);
    expect(screen.getByText('A fidelidade precisa do servidor')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Conectar ao servidor/ }));
    expect(onConnect).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('regra atual (CA-02)', () => {
  it('explica a regra padrão com exemplos', async () => {
    withRule();
    renderApi();
    const panel = await screen.findByLabelText('Regra atual');
    const content = flat(panel);
    expect(content).toContain('1 ponto por real');
    expect(content).toContain('Cada ponto vale R$ 0,05');
    expect(content).toContain('Resgate mínimo de 100 pontos');
    expect(content).toContain('vale R$ 5,00');
    expect(content).toContain('Uma conta de R$ 100,00 gera 100 pontos');
  });
});

describe('alterar regra (CA-03, CA-04)', () => {
  it('mostra a prévia e envia só o campo alterado', async () => {
    const calls = withRule({ 'PUT /loyalty/settings': () => ({ body: { ...standard, centsPerPoint: 10 } }) });
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: /Alterar regra/ }));
    const dialog = screen.getByRole('dialog', { name: 'Alterar regra de fidelidade' });
    fireEvent.change(within(dialog).getByLabelText(/Valor do ponto em centavos/), { target: { value: '10' } });
    expect(flat(within(dialog).getByRole('note'))).toContain('o resgate mínimo vale R$ 10,00');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar regra' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ centsPerPoint: 10 });
    expect((await screen.findByRole('status')).textContent).toBe('Pronto, regra de fidelidade atualizada.');
    expect(flat(screen.getByLabelText('Regra atual'))).toContain('Cada ponto vale R$ 0,10');
  });

  it('recusa 101 pontos por real sem enviar', async () => {
    const calls = withRule();
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: /Alterar regra/ }));
    fireEvent.change(screen.getByLabelText(/Pontos por real/), { target: { value: '101' } });
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar regra' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Regra de fidelidade inválida: pontos por real.');
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('sem mudança fecha sem enviar', async () => {
    const calls = withRule();
    renderApi();
    fireEvent.click(await screen.findByRole('button', { name: /Alterar regra/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar regra' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });
});

describe('consulta do cliente (CA-05, CA-06)', () => {
  it('busca, escolhe e mostra saldo e extrato', async () => {
    const calls = withRule();
    renderApi();
    fireEvent.change(await screen.findByLabelText('Buscar cliente'), { target: { value: 'ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    fireEvent.click(await screen.findByRole('button', { name: /Ana Souza/ }));
    expect(await screen.findByText('140 pontos')).toBeTruthy();
    expect(flat(screen.getByText(/valem/))).toContain('R$ 7,00');
    const entries = screen.getByRole('list', { name: 'Extrato de pontos' });
    const content = flat(entries);
    expect(content).toContain('Ganho');
    expect(content).toContain('+140');
    expect(content).toContain('Resgate');
    expect(content).toContain('−100');
    expect(content).toContain('Devolução');
    expect(content).toContain('Comanda #21');
    expect(calls.some((c) => c.path === '/customers?search=ana')).toBe(true);
  });

  it('pede pelo menos 2 caracteres na busca', async () => {
    const calls = withRule();
    renderApi();
    fireEvent.change(await screen.findByLabelText('Buscar cliente'), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/pelo menos 2/);
    expect(calls.some((c) => c.path.startsWith('/customers'))).toBe(false);
  });

  it('avisa quando ninguém é encontrado', async () => {
    withRule({ 'GET /customers': () => ({ body: [] }) });
    renderApi();
    fireEvent.change(await screen.findByLabelText('Buscar cliente'), { target: { value: 'zé' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText('Nenhum cliente encontrado.')).toBeTruthy();
  });

  it('mostra a mensagem da API ao falhar', async () => {
    withRule({ 'GET /customers/1/loyalty': () => ({ body: { message: 'Cliente não encontrado.' }, status: 404 }) });
    renderApi();
    fireEvent.change(await screen.findByLabelText('Buscar cliente'), { target: { value: 'ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    fireEvent.click(await screen.findByRole('button', { name: /Ana Souza/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Cliente não encontrado.');
  });
});
