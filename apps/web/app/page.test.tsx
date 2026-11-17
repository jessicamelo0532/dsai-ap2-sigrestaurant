// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api';
});

import Home from './page';
import { setMode } from '@/lib/store';
import type { Expense, MenuItem, Report, Table } from '@/lib/types';

const menuItems: MenuItem[] = [
  { id: 1, name: 'Açaí', description: 'Da casa', category: 'Sobremesas', price: '18.00', available: true },
  { id: 2, name: 'Suco', description: null, category: 'Bebidas', price: '7.50', available: false },
];

const tables: Table[] = [
  {
    id: 1,
    number: 1,
    capacity: 4,
    order: {
      id: 10,
      tableNumber: 1,
      status: 'OPEN',
      openedAt: new Date().toISOString(),
      items: [{ id: 5, menuItemId: 1, nameSnapshot: 'Açaí', unitPrice: '18.00', quantity: 2 }],
    },
  },
  { id: 2, number: 2, capacity: 2, order: null },
];

const report: Report = {
  paidOrders: 3,
  revenue: '120.00',
  expenses: '40.00',
  expenseCount: 1,
  balance: '80.00',
  payments: { CASH: '20.00', CREDIT: '50.00', DEBIT: '0.00', PIX: '50.00' },
};

const expenses: Expense[] = [{ id: 1, description: 'Gás', amount: '40.00', incurredAt: '2026-11-17T12:00:00.000Z' }];

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

function serverRoutes(): Record<string, Route> {
  return {
    'GET /health': () => ({ body: { status: 'ok' } }),
    'GET /tables': () => ({ body: tables }),
    'GET /menu-items': () => ({ body: menuItems }),
    'GET /reports/financial': () => ({ body: report }),
    'GET /expenses': () => ({ body: expenses }),
    'GET /kitchen/queue': () => ({ body: { generatedAt: new Date().toISOString(), summary: { total: 0, byStatus: { QUEUED: 0, PREPARING: 0, READY: 0 }, byBand: { NO_PRAZO: 0, ATENCAO: 0, ATRASADO: 0 }, highPriority: 0 }, tickets: [] } }),
  };
}

beforeEach(() => {
  window.localStorage.clear();
  setMode('api');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setMode('api');
});

describe('tela principal no modo servidor (RF-01 a RF-04)', () => {
  it('carrega mesas, cardápio e relatório do servidor', async () => {
    const calls = stubApi(serverRoutes());
    render(<Home />);

    expect(await screen.findByText('Conectado ao servidor')).toBeTruthy();
    expect(screen.getByText(/Bom dia, equipe/)).toBeTruthy();
    await waitFor(() => expect(document.querySelectorAll('.table-card')).toHaveLength(2));
    expect(screen.getAllByText('Açaí').length).toBeGreaterThan(0);
    expect(screen.getByText('R$ 120,00')).toBeTruthy();
    expect(calls.some((call) => call.method === 'GET' && call.path === '/tables')).toBe(true);
    expect(calls.some((call) => call.path === '/menu-items?all=true')).toBe(true);
  });

  it('abre a comanda da mesa e mostra os itens e o total', async () => {
    stubApi(serverRoutes());
    render(<Home />);

    await waitFor(() => expect(document.querySelectorAll('.table-card')).toHaveLength(2));
    expect(screen.getByRole('heading', { name: 'Mesa 01' })).toBeTruthy();
    expect(screen.getByText('2 × R$ 18,00')).toBeTruthy();
    expect(screen.getAllByText('R$ 36,00').length).toBeGreaterThan(0);
    expect(screen.getByText('ABERTA')).toBeTruthy();
  });

  it('troca a mesa selecionada ao clicar no cartão livre', async () => {
    stubApi(serverRoutes());
    render(<Home />);

    await waitFor(() => expect(document.querySelectorAll('.table-card')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: /Mesa 02/ }));

    expect(screen.getByRole('heading', { name: 'Mesa 02' })).toBeTruthy();
    expect(screen.getByText('Mesa livre')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Enviar para a cozinha/ })).toBeNull();
  });
});

describe('envio para a cozinha (RF-05)', () => {
  it('envia a observação e limpa o campo', async () => {
    const calls = stubApi({ ...serverRoutes(), 'POST /orders/10/kitchen': () => ({ body: { id: 1 } }) });
    render(<Home />);

    const note = await screen.findByPlaceholderText('Observação para a cozinha (opcional)');
    fireEvent.change(note, { target: { value: 'sem cebola' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar para a cozinha/ }));

    await waitFor(() => {
      const sent = calls.find((call) => call.method === 'POST' && call.path === '/orders/10/kitchen');
      expect(sent).toBeTruthy();
      expect(sent!.body).toEqual({ note: 'sem cebola' });
    });
    expect(await screen.findByText('Pedido enviado para a cozinha.')).toBeTruthy();
    expect((screen.getByPlaceholderText('Observação para a cozinha (opcional)') as HTMLInputElement).value).toBe('');
  });

  it('avisa a observação longa sem chamar a API', async () => {
    const calls = stubApi(serverRoutes());
    render(<Home />);

    const note = await screen.findByPlaceholderText('Observação para a cozinha (opcional)');
    fireEvent.change(note, { target: { value: 'x'.repeat(201) } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar para a cozinha/ }));

    expect(await screen.findByText('A observação pode ter até 200 caracteres.')).toBeTruthy();
    expect(calls.some((call) => call.path === '/orders/10/kitchen')).toBe(false);
  });
});

describe('fechamento de conta (RF-06)', () => {
  it('fecha a conta com a forma de pagamento escolhida', async () => {
    const calls = stubApi({
      ...serverRoutes(),
      'POST /orders/10/close': () => ({
        body: { id: 10, tableNumber: 1, status: 'PAID', paymentMethod: 'CASH', paidAt: '2026-11-17T20:15:00.000Z', openedAt: new Date().toISOString(), items: [{ id: 5, menuItemId: 1, nameSnapshot: 'Açaí', unitPrice: '18.00', quantity: 2 }] },
      }),
    });
    render(<Home />);

    fireEvent.click(await screen.findByRole('button', { name: /Fechar conta/ }));
    expect(screen.getByRole('dialog', { name: 'Fechar conta' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Dinheiro/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

    await waitFor(() => {
      const sent = calls.find((call) => call.method === 'POST' && call.path === '/orders/10/close');
      expect(sent?.body).toEqual({ paymentMethod: 'CASH' });
    });
    expect(await screen.findByText('Pronto, conta fechada e mesa liberada.')).toBeTruthy();
    expect(await screen.findByRole('dialog', { name: 'Cupom da conta' })).toBeTruthy();
    expect(screen.getByText('Pagamento: Dinheiro')).toBeTruthy();
  });
});

describe('navegação entre as seções', () => {
  it('abre o cardápio com a lista e a busca', async () => {
    stubApi(serverRoutes());
    render(<Home />);

    await screen.findByText('Conectado ao servidor');
    fireEvent.click(screen.getByRole('button', { name: 'Cardápio' }));

    expect(screen.getByRole('heading', { name: 'Cardápio' })).toBeTruthy();
    expect(screen.getByText('Itens cadastrados')).toBeTruthy();
    expect(screen.getByText('Pausado')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Buscar item'), { target: { value: 'suco' } });
    expect(screen.queryByText('Sobremesas')).toBeNull();
    expect(screen.getByText('Bebidas')).toBeTruthy();
  });

  it('abre o financeiro com receita, despesas e pagamentos', async () => {
    stubApi(serverRoutes());
    render(<Home />);

    await screen.findByText('Conectado ao servidor');
    fireEvent.click(screen.getByRole('button', { name: 'Financeiro' }));

    expect(screen.getByRole('heading', { name: 'O dinheiro da casa' })).toBeTruthy();
    expect(screen.getByText('Receita de vendas')).toBeTruthy();
    expect(screen.getAllByText('R$ 120,00').length).toBeGreaterThan(0);
    expect(screen.getByText('Gás')).toBeTruthy();
    expect(screen.getByText('Vendas por pagamento')).toBeTruthy();
  });

  it('abre o salão e a cozinha', async () => {
    stubApi(serverRoutes());
    render(<Home />);

    await screen.findByText('Conectado ao servidor');
    fireEvent.click(screen.getByRole('button', { name: 'Salão' }));
    expect(screen.getByRole('heading', { name: 'Salão' })).toBeTruthy();
    expect(screen.getByText('Mesas ocupadas')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cozinha' }));
    expect(screen.getByRole('heading', { name: 'Cozinha' })).toBeTruthy();
    expect(await screen.findByText('Nenhum pedido na cozinha')).toBeTruthy();
  });
});

describe('modo servidor fora do ar (RF-07)', () => {
  it('mostra a escolha explícita e permite usar o modo local', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('sem rede'); }));
    render(<Home />);

    expect(await screen.findByText('Servidor indisponível')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Usar o modo local' }));
    expect(await screen.findByText('Dados só neste navegador')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Conectar ao servidor' })).toBeTruthy();
  });
});

describe('modo navegador (RF-08)', () => {
  it('não fala com a API e usa os dados deste navegador', async () => {
    const calls = stubApi(serverRoutes());
    setMode('local');
    render(<Home />);

    expect(await screen.findByText('Dados só neste navegador')).toBeTruthy();
    await waitFor(() => expect(document.querySelectorAll('.table-card')).toHaveLength(5));
    expect(screen.getAllByText('Bruschetta da casa').length).toBeGreaterThan(0);
    expect(calls).toHaveLength(0);
  });
});

describe('link por mesa e QR (SPEC/2026-11-17-pwa-e-qr-das-mesas.md)', () => {
  afterEach(() => { window.history.replaceState(null, '', '/'); });

  it('abre a mesa do link ?mesa=3 e limpa o endereço (CA-03)', async () => {
    setMode('local');
    window.history.replaceState(null, '', '/?mesa=3');
    render(<Home />);

    expect(await screen.findByRole('heading', { name: 'Mesa 03' })).toBeTruthy();
    expect(window.location.search).toBe('');
  });

  it('avisa quando a mesa do link não existe (CA-03)', async () => {
    setMode('local');
    window.history.replaceState(null, '', '/?mesa=99');
    render(<Home />);

    expect(await screen.findByText('A mesa 99 não existe neste salão.')).toBeTruthy();
  });

  it('o Salão abre os cartões com QR (CA-04)', async () => {
    setMode('local');
    render(<Home />);
    await waitFor(() => expect(document.querySelectorAll('.table-card')).toHaveLength(5));

    fireEvent.click(screen.getAllByRole('button', { name: /Salão/ })[0]);
    fireEvent.click(await screen.findByRole('button', { name: /QR das mesas/ }));
    expect(screen.getAllByRole('article', { name: /^QR da Mesa/ })).toHaveLength(5);
  });
});

