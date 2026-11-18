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
import { stubApi, Route } from '@/test/api';
function serverRoutes(): Record<string, Route> {
  return {
    'GET /health': () => ({ body: { status: 'ok' } }),
    'GET /tables': () => ({ body: tables }),
    'GET /menu-items': () => ({ body: menuItems }),
    'GET /reports/financial': () => ({ body: report }),
    'GET /expenses': () => ({ body: expenses }),
    'GET /waiters': () => ({ body: [{ id: 1, name: 'Rui', active: true }] }),
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

describe('venda a prazo na comanda (SPEC/2026-11-17-contas-a-receber.md)', () => {
  it('o botão aparece no modo servidor e abre a janela com o total', async () => {
    stubApi(serverRoutes());
    render(<Home />);
    fireEvent.click(await screen.findByRole('button', { name: /Vender a prazo/ }));
    const dialog = screen.getByRole('dialog', { name: 'Vender a prazo' });
    expect((dialog.textContent ?? '').replace(/\s/g, ' ')).toContain('R$ 36,00');
  });

  it('não aparece no modo navegador', async () => {
    setMode('local');
    render(<Home />);
    expect(await screen.findByText('Dados só neste navegador')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Vender a prazo/ })).toBeNull();
  });
});

describe('atendimento na comanda (SPEC/2026-11-17-atendimento-na-comanda.md)', () => {
  it('mostra o bloco no modo servidor e o total com o desconto dos pontos (CA-07)', async () => {
    const withDiscount: Table[] = [{ ...tables[0], order: { ...tables[0].order!, customerId: 5, discount: '10.00', loyaltyPoints: 200 } }, tables[1]];
    stubApi({
      ...serverRoutes(),
      'GET /tables': () => ({ body: withDiscount }),
      'GET /customers/5': () => ({ body: { id: 5, name: 'Ana Souza', phone: null } }),
      'GET /customers/5/loyalty': () => ({ body: { customerId: 5, balance: 50, balanceValue: '2.50', entries: [] } }),
      'GET /loyalty/settings': () => ({ body: { pointsPerReal: 1, centsPerPoint: 5, minRedeemPoints: 100 } }),
    });
    render(<Home />);

    expect(await screen.findByRole('region', { name: 'Atendimento' })).toBeTruthy();
    expect(await screen.findByText('Ana Souza')).toBeTruthy();
    expect(screen.getByText('Desconto (pontos)')).toBeTruthy();
    expect(screen.getByText('Total a pagar')).toBeTruthy();
    expect(screen.getAllByText('R$ 26,00').length).toBeGreaterThan(0);
  });

  it('sem desconto mantém o total da comanda', async () => {
    stubApi(serverRoutes());
    render(<Home />);

    expect(await screen.findByRole('region', { name: 'Atendimento' })).toBeTruthy();
    expect(screen.getByText('Total da comanda')).toBeTruthy();
    expect(screen.queryByText('Desconto (pontos)')).toBeNull();
  });

  it('não aparece no modo navegador (CA-01)', async () => {
    const calls = stubApi(serverRoutes());
    setMode('local');
    render(<Home />);

    expect(await screen.findByText('Dados só neste navegador')).toBeTruthy();
    await waitFor(() => expect(document.querySelectorAll('.table-card')).toHaveLength(5));
    expect(screen.queryByRole('region', { name: 'Atendimento' })).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe('mesa e contas na comanda (SPEC/2026-11-17-mover-e-juntar-na-tela.md)', () => {
  it('transfere a comanda para outra mesa no modo navegador (CA-01)', async () => {
    setMode('local');
    render(<Home />);
    await waitFor(() => expect(document.querySelectorAll('.table-card')).toHaveLength(5));

    fireEvent.click(screen.getAllByRole('button', { name: /Bruschetta da casa/ })[0]);
    fireEvent.click(await screen.findByRole('button', { name: /Transferir mesa/ }));
    fireEvent.change(screen.getByLabelText('Mesa de destino'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Cliente pediu janela' } });
    fireEvent.click(screen.getByRole('button', { name: 'Transferir' }));

    expect(await screen.findByRole('heading', { name: 'Mesa 04' })).toBeTruthy();
    expect(await screen.findByText('Transferida da mesa 01 para a mesa 04')).toBeTruthy();
  });
});

describe('quantidade e cancelamento na comanda (SPEC/2026-11-17-quantidade-e-cancelamento-na-comanda.md)', () => {
  it('aumenta a quantidade pelo modo servidor (CA-01)', async () => {
    const calls = stubApi({ ...serverRoutes(), 'PATCH /orders/10/items/5': () => ({ body: tables[0].order }) });
    render(<Home />);

    fireEvent.click(await screen.findByRole('button', { name: 'Aumentar Açaí' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'PATCH')).toBe(true));
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ quantity: 3 });
  });

  it('no modo navegador, muda a quantidade e cancela a comanda (CA-02, CA-03)', async () => {
    setMode('local');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Home />);
    await waitFor(() => expect(document.querySelectorAll('.table-card')).toHaveLength(5));

    fireEvent.click(screen.getAllByRole('button', { name: /Bruschetta da casa/ })[0]);
    expect((await screen.findByRole('button', { name: 'Diminuir Bruschetta da casa' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar Bruschetta da casa' }));
    expect(await screen.findByText('2 × R$ 24,00')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Cancelar comanda/ }));
    expect(await screen.findByText('Comanda cancelada.')).toBeTruthy();
    expect(screen.getByText('Mesa livre')).toBeTruthy();
  });

  it('sem confirmar, não cancela', async () => {
    const calls = stubApi(serverRoutes());
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Home />);

    fireEvent.click(await screen.findByRole('button', { name: /Cancelar comanda/ }));
    expect(calls.some((call) => call.path.endsWith('/cancel'))).toBe(false);
  });
});

describe('lançar item com opções (SPEC/2026-11-17-tela-de-variacoes-e-adicionais.md)', () => {
  it('no modo servidor, item sem opções continua sendo lançado direto (CA-04)', async () => {
    const calls = stubApi({
      ...serverRoutes(),
      'GET /menu-items/1/options': () => ({ body: { menuItemId: 1, variants: [], addons: [] } }),
      'POST /tables/1/items': () => ({ body: tables[0].order }),
    });
    render(<Home />);
    await waitFor(() => expect(document.querySelectorAll('.table-card')).toHaveLength(2));

    fireEvent.click(screen.getAllByRole('button', { name: /Açaí/ }).find((button) => button.classList.contains('quick-item'))!);

    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/tables/1/items')).toBe(true));
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ menuItemId: 1, quantity: 1 });
    expect(await screen.findByText('Pronto, item lançado na comanda.')).toBeTruthy();
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

