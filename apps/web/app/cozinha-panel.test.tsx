// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api';
});

import { CozinhaPanel } from './cozinha-panel';
import type { KitchenQueue, KitchenTicket } from '@/lib/cozinha';

function ticket(overrides: Partial<KitchenTicket> = {}): KitchenTicket {
  return {
    id: 1,
    orderId: 10,
    tableNumber: 3,
    channel: 'DINE_IN',
    waiterName: 'Ana',
    status: 'QUEUED',
    priority: 'NORMAL',
    note: null,
    sentAt: '2026-11-17T12:00:00.000Z',
    startedAt: null,
    readyAt: null,
    deliveredAt: null,
    cancelledAt: null,
    waitingMinutes: 4,
    band: 'NO_PRAZO',
    items: [{ id: 1, name: 'Açaí', quantity: 2, addons: [] }],
    ...overrides,
  };
}

function queue(tickets: KitchenTicket[]): KitchenQueue {
  return {
    generatedAt: '2026-11-17T12:00:00.000Z',
    summary: { total: tickets.length, byStatus: { QUEUED: 0, PREPARING: 0, READY: 0 }, byBand: { NO_PRAZO: 0, ATENCAO: 0, ATRASADO: 0 }, highPriority: 0 },
    tickets,
  };
}

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

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('painel da cozinha no modo servidor (RF-01)', () => {
  it('desenha o resumo, os filtros e o cartão do pedido', async () => {
    stubApi({
      'GET /kitchen/queue': () => ({ body: queue([ticket({ note: 'sem cebola', waitingMinutes: 12, band: 'ATENCAO' })]) }),
    });
    render(<CozinhaPanel mode="api" canConnect onConnect={() => {}} />);

    expect(await screen.findByText('Mesa 03')).toBeTruthy();
    expect(screen.getByText('Pedido 001')).toBeTruthy();
    expect(document.querySelector('.status-badge')?.textContent).toBe('Aguardando');
    expect(document.querySelector('.band-badge')?.textContent).toBe('Atenção');
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('2×')).toBeTruthy();
    expect(screen.getByText('Açaí')).toBeTruthy();
    expect(screen.getByText('Observação: sem cebola')).toBeTruthy();
    expect(screen.getByText('12 min')).toBeTruthy();
    expect(screen.getByText('1 pedido')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Todas/ })).toBeTruthy();
  });

  it('mostra os adicionais e o delivery sem mesa', async () => {
    stubApi({
      'GET /kitchen/queue': () => ({ body: queue([
        ticket({ tableNumber: 0, channel: 'DELIVERY', items: [{ id: 1, name: 'Açaí', quantity: 1, addons: ['Granola', 'Leite ninho'] }] }),
      ]) }),
    });
    render(<CozinhaPanel mode="api" canConnect onConnect={() => {}} />);

    expect(await screen.findAllByText('Delivery')).toHaveLength(2);
    expect(document.querySelector('.channel-tag')?.textContent).toBe('Delivery');
    expect(screen.getByText('Granola · Leite ninho')).toBeTruthy();
  });

  it('mostra o estado vazio quando não há pedidos', async () => {
    stubApi({ 'GET /kitchen/queue': () => ({ body: queue([]) }) });
    render(<CozinhaPanel mode="api" canConnect onConnect={() => {}} />);
    expect(await screen.findByText('Nenhum pedido na cozinha')).toBeTruthy();
  });
});

describe('ações por situação (RF-02 e RF-03)', () => {
  it('só oferece as ações permitidas em cada situação', async () => {
    stubApi({
      'GET /kitchen/queue': () => ({ body: queue([
        ticket({ id: 1, status: 'QUEUED', tableNumber: 1 }),
        ticket({ id: 2, status: 'PREPARING', tableNumber: 2 }),
        ticket({ id: 3, status: 'READY', tableNumber: 4 }),
      ]) }),
    });
    render(<CozinhaPanel mode="api" canConnect onConnect={() => {}} />);

    await screen.findByText('Mesa 01');
    expect(screen.getAllByRole('button', { name: 'Iniciar preparo' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Pronto' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Entregue' })).toHaveLength(1);
  });

  it('chama a rota de iniciar preparo e recarrega a fila', async () => {
    const calls = stubApi({
      'GET /kitchen/queue': () => ({ body: queue([ticket({ id: 7 })]) }),
      'POST /kitchen/tickets/7/start': () => ({ body: ticket({ id: 7, status: 'PREPARING' }) }),
    });
    render(<CozinhaPanel mode="api" canConnect onConnect={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar preparo' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/kitchen/tickets/7/start')).toBe(true));
    expect(await screen.findByText('Pedido 007: iniciar preparo registrado.')).toBeTruthy();
  });

  it('mostra a mensagem de erro da API quando a transição é recusada', async () => {
    stubApi({
      'GET /kitchen/queue': () => ({ body: queue([ticket({ id: 9, status: 'READY' })]) }),
      'POST /kitchen/tickets/9/deliver': () => ({ status: 400, body: { message: 'Este pedido está pronto e não pode ser entregue.' } }),
    });
    render(<CozinhaPanel mode="api" canConnect onConnect={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Entregue' }));
    expect(await screen.findByText('Este pedido está pronto e não pode ser entregue.')).toBeTruthy();
  });
});

describe('prioridade (RF-04 e RN-03)', () => {
  it('bloqueia quem mudou inválido antes de chamar a API', async () => {
    const calls = stubApi({ 'GET /kitchen/queue': () => ({ body: queue([ticket({ id: 5 })]) }) });
    render(<CozinhaPanel mode="api" canConnect onConnect={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Marcar alta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));

    expect(await screen.findByText('Informe quem mudou a prioridade, de 2 a 80 caracteres.')).toBeTruthy();
    expect(calls.some((call) => call.method === 'PUT')).toBe(false);
  });

  it('envia a prioridade alternada com quem mudou', async () => {
    const calls = stubApi({
      'GET /kitchen/queue': () => ({ body: queue([ticket({ id: 5 })]) }),
      'PUT /kitchen/tickets/5/priority': () => ({ body: ticket({ id: 5, priority: 'HIGH' }) }),
    });
    render(<CozinhaPanel mode="api" canConnect onConnect={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Marcar alta' }));
    fireEvent.change(screen.getByPlaceholderText('Nome de quem está na cozinha'), { target: { value: 'Cozinha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() => {
      const put = calls.find((call) => call.method === 'PUT');
      expect(put).toBeTruthy();
      expect(put!.path).toBe('/kitchen/tickets/5/priority');
      expect(put!.body).toEqual({ priority: 'HIGH', changedBy: 'Cozinha' });
    });
    expect(await screen.findByText('Pedido 005: prioridade alta registrada.')).toBeTruthy();
  });
});

describe('filtros (RF-07)', () => {
  it('mostra só os atrasados no filtro', async () => {
    stubApi({
      'GET /kitchen/queue': () => ({ body: queue([
        ticket({ id: 1, tableNumber: 1, band: 'NO_PRAZO', waitingMinutes: 2 }),
        ticket({ id: 2, tableNumber: 2, band: 'ATRASADO', waitingMinutes: 30 }),
      ]) }),
    });
    render(<CozinhaPanel mode="api" canConnect onConnect={() => {}} />);

    await screen.findByText('Mesa 01');
    fireEvent.click(screen.getByRole('button', { name: /^Atrasados/ }));
    expect(screen.getByText('Mesa 02')).toBeTruthy();
    expect(screen.queryByText('Mesa 01')).toBeNull();
  });
});

describe('modo navegador (RF-08)', () => {
  it('explica que a cozinha precisa do servidor e não chama a API', () => {
    const calls = stubApi({});
    render(<CozinhaPanel mode="local" canConnect onConnect={() => {}} />);

    expect(screen.getByText('A cozinha precisa do servidor')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Conectar ao servidor' })).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});
