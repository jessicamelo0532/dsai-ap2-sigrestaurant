// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api'; });

import { ComandaAtendimento } from './comanda-atendimento';
import type { Order } from '@/lib/types';
import { stubApi, Route } from '@/test/api';
// Dados fictícios (AGENTS.md §9).
const base: Order = {
  id: 9, tableNumber: 4, status: 'OPEN', openedAt: '2026-11-17T12:00:00.000Z',
  items: [
    { id: 1, menuItemId: 1, nameSnapshot: 'Moqueca', unitPrice: '45.00', quantity: 1 },
    { id: 2, menuItemId: 2, nameSnapshot: 'Suco', unitPrice: '7.50', quantity: 2 },
  ],
  waiterId: null, waiterName: null, customerId: null, discount: '0.00', loyaltyPoints: 0,
};

const routes = (extra: Record<string, Route> = {}) => stubApi({
  'GET /waiters': () => ({ body: [{ id: 1, name: 'Rui', active: true }, { id: 2, name: 'Bia', active: false }, { id: 3, name: 'Ana', active: true }] }),
  'GET /customers': () => ({ body: [{ id: 5, name: 'Ana Souza', phone: '91988887777' }] }),
  'GET /customers/5': () => ({ body: { id: 5, name: 'Ana Souza', phone: '91988887777' } }),
  'GET /customers/5/loyalty': () => ({ body: { customerId: 5, balance: 250, balanceValue: '12.50', entries: [] } }),
  'GET /loyalty/settings': () => ({ body: { pointsPerReal: 1, centsPerPoint: 5, minRedeemPoints: 100 } }),
  'PUT /orders/9/waiter': () => ({ body: {} }),
  'PUT /orders/9/customer': () => ({ body: {} }),
  'POST /orders/9/loyalty': () => ({ body: {} }),
  'DELETE /orders/9/loyalty': () => ({ body: {} }),
  ...extra,
});

const flat = (text: string | null) => (text ?? '').replace(/\s/g, ' ');

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('garçom (CA-02)', () => {
  it('lista só ativos e atribui o escolhido', async () => {
    const calls = routes();
    const onChanged = vi.fn();
    render(<ComandaAtendimento order={base} onChanged={onChanged} />);
    const select = await screen.findByLabelText('Garçom') as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBe(3));
    expect([...select.options].map((option) => option.textContent)).toEqual(['Escolha o garçom', 'Ana', 'Rui']);
    fireEvent.change(select, { target: { value: '1' } });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ waiterId: 1 });
    expect(screen.getByRole('status').textContent).toBe('Rui atende esta mesa.');
  });

  it('mostra o garçom atual mesmo inativo', async () => {
    routes();
    render(<ComandaAtendimento order={{ ...base, waiterId: 2, waiterName: 'Bia' }} onChanged={() => {}} />);
    const select = await screen.findByLabelText('Garçom') as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('2'));
    expect(select.selectedOptions[0].textContent).toBe('Bia (inativo)');
  });
});

describe('cliente (CA-03)', () => {
  it('busca e liga o cliente', async () => {
    const calls = routes();
    const onChanged = vi.fn();
    render(<ComandaAtendimento order={base} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: /Ligar cliente/ }));
    fireEvent.change(screen.getByLabelText('Buscar cliente da comanda'), { target: { value: 'ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    fireEvent.click(await screen.findByRole('button', { name: /Ana Souza/ }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ customerId: 5 });
    expect(calls.some((c) => c.path === '/customers?search=ana')).toBe(true);
  });

  it('tira o cliente', async () => {
    const calls = routes();
    render(<ComandaAtendimento order={{ ...base, customerId: 5 }} onChanged={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /Tirar cliente/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ customerId: null });
  });

  it('pede pelo menos 2 caracteres na busca', async () => {
    const calls = routes();
    render(<ComandaAtendimento order={base} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Ligar cliente/ }));
    fireEvent.change(screen.getByLabelText('Buscar cliente da comanda'), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/pelo menos 2/);
    expect(calls.some((c) => c.path.startsWith('/customers?'))).toBe(false);
  });
});

describe('pontos (CA-04, CA-05)', () => {
  it('mostra saldo e prévia e usa os pontos', async () => {
    const calls = routes();
    const onChanged = vi.fn();
    render(<ComandaAtendimento order={{ ...base, customerId: 5 }} onChanged={onChanged} />);
    expect(flat((await screen.findByText(/Saldo: 250 pontos/)).textContent)).toContain('dá para usar até 250');
    fireEvent.change(screen.getByLabelText('Pontos para usar'), { target: { value: '200' } });
    expect(flat(screen.getByRole('note').textContent)).toBe('200 pontos viram R$ 10,00 de desconto.');
    fireEvent.click(screen.getByRole('button', { name: 'Usar pontos' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ points: 200 });
  });

  it.each([
    ['50', 'Resgate pelo menos 100 pontos.'],
    ['300', 'Saldo insuficiente: o cliente tem 250 pontos.'],
  ])('recusa %s pontos sem enviar', async (value, message) => {
    const calls = routes();
    render(<ComandaAtendimento order={{ ...base, customerId: 5 }} onChanged={() => {}} />);
    fireEvent.change(await screen.findByLabelText('Pontos para usar'), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Usar pontos' }));
    expect((await screen.findByRole('alert')).textContent).toBe(message);
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('recusa desconto maior que o subtotal', async () => {
    const calls = routes({ 'GET /customers/5/loyalty': () => ({ body: { customerId: 5, balance: 5000, balanceValue: '250.00', entries: [] } }) });
    render(<ComandaAtendimento order={{ ...base, customerId: 5 }} onChanged={() => {}} />);
    fireEvent.change(await screen.findByLabelText('Pontos para usar'), { target: { value: '1300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Usar pontos' }));
    expect(flat((await screen.findByRole('alert')).textContent)).toBe('O desconto de R$ 65,00 passa do total da comanda (R$ 60,00).');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('sem cliente não mostra pontos', async () => {
    routes();
    render(<ComandaAtendimento order={base} onChanged={() => {}} />);
    await screen.findByLabelText('Garçom');
    expect(screen.queryByLabelText('Pontos para usar')).toBeNull();
  });
});

describe('com resgate (CA-06, CA-08)', () => {
  const redeemed = { ...base, customerId: 5, discount: '10.00', loyaltyPoints: 200 };

  it('mostra o resgate, trava o cliente e desfaz', async () => {
    const calls = routes();
    const onChanged = vi.fn();
    render(<ComandaAtendimento order={redeemed} onChanged={onChanged} />);
    expect(flat((await screen.findByText(/pontos usados/)).textContent)).toBe('200 pontos usados · desconto de R$ 10,00');
    expect(screen.queryByRole('button', { name: 'Usar pontos' })).toBeNull();
    expect((await screen.findByRole('button', { name: /Tirar cliente/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer resgate' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/orders/9/loyalty')).toBe(true);
  });

  it('mostra o erro da API', async () => {
    routes({ 'DELETE /orders/9/loyalty': () => ({ body: { message: 'Esta comanda não tem resgate de pontos.' }, status: 400 }) });
    const onChanged = vi.fn();
    render(<ComandaAtendimento order={redeemed} onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Desfazer resgate' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Esta comanda não tem resgate de pontos.');
    expect(onChanged).not.toHaveBeenCalled();
  });
});
