// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api'; });

import { DeliveryPanel } from './delivery-panel';
import { setMode } from '@/lib/store';
import type { DeliveryOrder } from '@/lib/delivery';
import type { MenuItem } from '@/lib/types';

// SPEC/2026-11-25-tela-de-delivery.md (CA-01 a CA-06).
import { stubApi } from '@/test/api';

const menu: MenuItem[] = [
  { id: 7, name: 'Pizza', description: null, category: 'Pratos', price: '30.00', available: true },
  { id: 8, name: 'Suco', description: null, category: 'Bebidas', price: '9.00', available: false },
];

const baseOrder: DeliveryOrder = {
  id: 12,
  status: 'OPEN',
  openedAt: '2026-11-25T18:00:00.000Z',
  recipient: 'Ana Souza',
  deliveryAddress: 'Rua das Flores, 123',
  deliveryPhone: '91999998888',
  deliveryStatus: 'RECEIVED',
  subtotal: '30.00',
  discount: '0.00',
  deliveryFee: '5.00',
  total: '35.00',
  items: [
    { id: 1, menuItemId: 7, nameSnapshot: 'Pizza', unitPrice: '30.00', quantity: 1 },
  ],
};

beforeEach(() => { window.localStorage.clear(); setMode('api'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); setMode('api'); });

describe('seção Delivery (CA-05, CA-06)', () => {
  it('no modo navegador avisa que precisa do servidor e não chama a API', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<DeliveryPanel mode="local" canConnect onConnect={() => {}} menu={menu} />);
    expect(screen.getByText('Delivery precisa do servidor')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('carrega a lista ativa com resumo e filtra por situação', async () => {
    const calls = stubApi({
      'GET /delivery-orders': () => ({ body: [baseOrder] }),
    });
    render(<DeliveryPanel mode="api" canConnect onConnect={() => {}} menu={menu} />);

    expect(await screen.findByText('Ana Souza')).toBeTruthy();
    expect(within(screen.getByLabelText('Resumo')).getByText('Recebidos')).toBeTruthy();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);

    const filters = screen.getByRole('group', { name: 'Filtrar pedidos' });
    fireEvent.click(within(filters).getByRole('button', { name: 'Saiu para entrega' }));
    await waitFor(() => expect(calls.some((call) => call.path.includes('status=OUT_FOR_DELIVERY'))).toBe(true));
  });
});

describe('novo pedido (CA-04)', () => {
  it('recusa destinatário curto e taxa acima do limite sem chamar a API', async () => {
    const calls = stubApi({ 'GET /delivery-orders': () => ({ body: [] }) });
    render(<DeliveryPanel mode="api" canConnect onConnect={() => {}} menu={menu} />);
    fireEvent.click(screen.getByRole('button', { name: /Novo pedido/ }));

    fireEvent.change(screen.getByLabelText('Quem recebe'), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText('Endereço de entrega'), { target: { value: 'Rua' } });
    fireEvent.change(screen.getByLabelText('Taxa de entrega (R$)'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar pedido' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Informe o nome de quem recebe, de 2 a 80 caracteres.');
    expect(calls.some((call) => call.method === 'POST')).toBe(false);

    fireEvent.change(screen.getByLabelText('Quem recebe'), { target: { value: 'Ana Souza' } });
    fireEvent.change(screen.getByLabelText('Endereço de entrega'), { target: { value: 'Rua das Flores, 123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar pedido' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Informe a taxa de entrega de R$ 0,00 a R$ 100,00.');
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('cria o pedido e abre o detalhe', async () => {
    const calls = stubApi({
      'GET /delivery-orders': () => ({ body: [] }),
      'POST /delivery-orders': () => ({ body: baseOrder, status: 201 }),
    });
    render(<DeliveryPanel mode="api" canConnect onConnect={() => {}} menu={menu} />);
    fireEvent.click(screen.getByRole('button', { name: /Novo pedido/ }));

    fireEvent.change(screen.getByLabelText('Quem recebe'), { target: { value: 'Ana Souza' } });
    fireEvent.change(screen.getByLabelText('Endereço de entrega'), { target: { value: 'Rua das Flores, 123' } });
    fireEvent.change(screen.getByLabelText('Taxa de entrega (R$)'), { target: { value: '5,00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar pedido' }));

    const dialog = await screen.findByRole('dialog', { name: 'Pedido de Ana Souza' });
    expect(within(dialog).getByText('Rua das Flores, 123')).toBeTruthy();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      recipient: 'Ana Souza',
      address: 'Rua das Flores, 123',
      fee: 5,
    });
  });
});

describe('detalhe e acompanhamento (CA-01, CA-02, CA-03)', () => {
  async function openDetail(routes: Parameters<typeof stubApi>[0] = {}) {
    stubApi({ 'GET /delivery-orders': () => ({ body: [baseOrder] }), ...routes });
    render(<DeliveryPanel mode="api" canConnect onConnect={() => {}} menu={menu} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir' }));
    return screen.getByRole('dialog', { name: 'Pedido de Ana Souza' });
  }

  it('mostra subtotal, taxa e total devolvidos pela API', async () => {
    const dialog = await openDetail();
    expect(within(dialog).getByText('Subtotal')).toBeTruthy();
    expect(within(dialog).getByText('Taxa de entrega')).toBeTruthy();
    expect(within(dialog).getAllByText(/30,00/).length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText(/5,00/).length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText(/35,00/).length).toBeGreaterThan(0);
  });

  it('sai para entrega e passa a oferecer Entregue', async () => {
    let current = baseOrder;
    const calls = stubApi({
      'GET /delivery-orders': () => ({ body: [current] }),
      'GET /delivery-orders/12': () => ({ body: current }),
      'POST /delivery-orders/12/dispatch': () => {
        current = { ...current, deliveryStatus: 'OUT_FOR_DELIVERY', dispatchedAt: '2026-11-25T18:30:00.000Z' };
        return { body: current };
      },
    });
    render(<DeliveryPanel mode="api" canConnect onConnect={() => {}} menu={menu} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog', { name: 'Pedido de Ana Souza' });

    fireEvent.click(within(dialog).getByRole('button', { name: /Saiu para entrega/ }));
    await waitFor(() => expect(within(dialog).getByText('Saiu para entrega')).toBeTruthy());
    expect(within(dialog).queryByRole('button', { name: /Editar dados/ })).toBeNull();
    expect(within(dialog).getByRole('button', { name: /Entregue/ })).toBeTruthy();
    expect(calls.some((call) => call.path === '/delivery-orders/12/dispatch')).toBe(true);
  });

  it('edita os dados enquanto recebido', async () => {
    let current = baseOrder;
    const calls = stubApi({
      'GET /delivery-orders': () => ({ body: [current] }),
      'GET /delivery-orders/12': () => ({ body: current }),
      'PATCH /delivery-orders/12': () => {
        current = { ...current, recipient: 'Bia Lima' };
        return { body: current };
      },
    });
    render(<DeliveryPanel mode="api" canConnect onConnect={() => {}} menu={menu} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog', { name: 'Pedido de Ana Souza' });

    fireEvent.click(within(dialog).getByRole('button', { name: /Editar dados/ }));
    fireEvent.change(screen.getByLabelText('Quem recebe'), { target: { value: 'Bia Lima' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ recipient: 'Bia Lima' }));
  });

  it('lança item do cardápio no pedido', async () => {
    const calls = stubApi({
      'GET /delivery-orders': () => ({ body: [baseOrder] }),
      'GET /delivery-orders/12': () => ({ body: baseOrder }),
      'GET /menu-items/7/options': () => ({ body: { menuItemId: 7, variants: [], addons: [] } }),
      'POST /delivery-orders/12/items': () => ({ body: baseOrder }),
    });
    render(<DeliveryPanel mode="api" canConnect onConnect={() => {}} menu={menu} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog', { name: 'Pedido de Ana Souza' });

    fireEvent.click(within(dialog).getByRole('button', { name: /Pizza.*Pratos/ }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/delivery-orders/12/items')).toBe(true));
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ menuItemId: 7, quantity: 1 });
  });

  it('paga o pedido com a forma escolhida', async () => {
    const calls = stubApi({
      'GET /delivery-orders': () => ({ body: [baseOrder] }),
      'POST /orders/12/close': () => ({ body: { ...baseOrder, status: 'PAID' } }),
    });
    render(<DeliveryPanel mode="api" canConnect onConnect={() => {}} menu={menu} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog', { name: 'Pedido de Ana Souza' });

    fireEvent.click(within(dialog).getByRole('button', { name: /Pagar/ }));
    fireEvent.change(screen.getByLabelText('Forma de pagamento'), { target: { value: 'PIX' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ paymentMethod: 'PIX' }));
  });
});
