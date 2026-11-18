// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api'; });

import { ReceberPanel } from './receber-panel';
import { VenderAPrazo } from './vender-a-prazo';
import { setMode } from '@/lib/store';
import { defaultDueDate, isoDay, type Receivable, type ReceivableList } from '@/lib/receber';
import type { Order } from '@/lib/types';

// SPEC/2026-11-17-contas-a-receber.md (T-05, CA-06)
import { stubApi } from '@/test/api';
// Dados fictícios (AGENTS.md §9).
const base: Receivable = {
  id: 1, orderId: 10, tableNumber: 4, customerId: 5, customerName: 'Ana Souza', amount: '60.00', issuedAt: '2026-11-10',
  dueDate: '2026-11-15', status: 'OPEN', situation: 'OVERDUE', paymentMethod: null, receivedAt: null, notes: 'paga sexta',
};
const data: ReceivableList = {
  today: '2026-11-17',
  summary: { openCount: 2, open: '90.00', overdue: '60.00', dueNext7Days: '30.00', paidCount: 1, received: '40.00' },
  receivables: [
    base,
    { ...base, id: 2, customerName: 'Bia Lima', amount: '30.00', dueDate: '2026-11-20', situation: 'UPCOMING', notes: null },
    { ...base, id: 3, customerName: 'Caio Reis', amount: '40.00', status: 'PAID', situation: null, paymentMethod: 'PIX', receivedAt: '2026-11-12', notes: null },
  ],
};

const order: Order = {
  id: 9, tableNumber: 4, status: 'OPEN', openedAt: '2026-11-17T12:00:00.000Z', customerId: 5,
  items: [{ id: 1, menuItemId: 1, nameSnapshot: 'Moqueca', unitPrice: '60.00', quantity: 1 }],
};

beforeEach(() => { window.localStorage.clear(); setMode('api'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); setMode('api'); });

describe('seção A receber (RF-05)', () => {
  it('no modo navegador avisa que precisa do servidor', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<ReceberPanel mode="local" canConnect onConnect={() => {}} />);
    expect(screen.getByText('Contas a receber precisam do servidor')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mostra o resumo e filtra os títulos', async () => {
    stubApi({ 'GET /receivables': () => ({ body: data }) });
    render(<ReceberPanel mode="api" canConnect onConnect={() => {}} />);

    const summary = await screen.findByLabelText('Resumo');
    expect((summary.textContent ?? '').replace(/\s/g, ' ')).toContain('R$ 90,00');
    expect((summary.textContent ?? '').replace(/\s/g, ' ')).toContain('R$ 60,00');
    expect(screen.getByText('Ana Souza')).toBeTruthy();
    expect(screen.getByText('Vencido · 15/11/2026')).toBeTruthy();
    expect(screen.queryByText('Caio Reis')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Quitados/ }));
    expect(screen.getByText('Caio Reis')).toBeTruthy();
    expect(screen.getByText('Recebido em 12/11/2026 · Pix')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Vencidos/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('dá baixa com forma e data e recarrega', async () => {
    const calls = stubApi({
      'GET /receivables': () => ({ body: data }),
      'POST /receivables/1/receive': () => ({ body: { ...base, status: 'PAID' } }),
    });
    render(<ReceberPanel mode="api" canConnect onConnect={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Receber de Ana Souza' }));
    const dialog = screen.getByRole('dialog', { name: 'Dar baixa' });
    fireEvent.change(within(dialog).getByLabelText('Forma de pagamento'), { target: { value: 'CASH' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar recebimento' }));

    expect(((await screen.findByRole('status')).textContent ?? '').replace(/\s/g, ' ')).toBe('Recebido: Ana Souza, R$ 60,00.');
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ paymentMethod: 'CASH', receivedAt: isoDay(new Date()) });
    expect(calls.filter((c) => c.path === '/receivables')).toHaveLength(2);
  });

  it('recusa data antes da venda sem enviar', async () => {
    const calls = stubApi({ 'GET /receivables': () => ({ body: data }) });
    render(<ReceberPanel mode="api" canConnect onConnect={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Receber de Ana Souza' }));
    fireEvent.change(screen.getByLabelText('Data do recebimento'), { target: { value: '2026-11-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));

    expect(screen.getByRole('alert').textContent).toBe('O recebimento não pode ser antes da venda.');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});

describe('vender a prazo (RF-04, CA-06)', () => {
  it('usa o cliente da comanda e envia cliente e vencimento', async () => {
    const calls = stubApi({
      'GET /customers/5': () => ({ body: { id: 5, name: 'Ana Souza', phone: null } }),
      'POST /orders/9/on-account': () => ({ body: base }),
    });
    const onDone = vi.fn();
    render(<VenderAPrazo order={order} totalLabel="R$ 60,00" onCancel={() => {}} onDone={onDone} />);

    expect(await screen.findByText('Ana Souza')).toBeTruthy();
    expect((screen.getByLabelText('Vencimento') as HTMLInputElement).value).toBe(defaultDueDate());
    fireEvent.change(screen.getByLabelText('Observação (opcional)'), { target: { value: 'paga sexta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar venda a prazo' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('Venda a prazo registrada para Ana Souza.'));
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ customerId: 5, dueDate: defaultDueDate(), notes: 'paga sexta' });
  });

  it('sem cliente na comanda, busca e escolhe; sem cliente, recusa', async () => {
    const calls = stubApi({
      'GET /customers': () => ({ body: [{ id: 7, name: 'Bia Lima', phone: '91988887777' }] }),
      'POST /orders/9/on-account': () => ({ body: base }),
    });
    render(<VenderAPrazo order={{ ...order, customerId: null }} totalLabel="R$ 60,00" onCancel={() => {}} onDone={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar venda a prazo' }));
    expect(screen.getByRole('alert').textContent).toBe('Informe o cliente para vender a prazo.');

    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'bia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    fireEvent.click(await screen.findByRole('button', { name: /Bia Lima/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar venda a prazo' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect((calls.find((c) => c.method === 'POST')?.body as { customerId: number }).customerId).toBe(7);
  });

  it('mostra o erro da API', async () => {
    stubApi({
      'GET /customers/5': () => ({ body: { id: 5, name: 'Ana Souza', phone: null } }),
      'POST /orders/9/on-account': () => ({ body: { message: 'Este cliente está desativado.' }, status: 400 }),
    });
    render(<VenderAPrazo order={order} totalLabel="R$ 60,00" onCancel={() => {}} onDone={() => {}} />);
    await screen.findByText('Ana Souza');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar venda a prazo' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Este cliente está desativado.');
  });
});
