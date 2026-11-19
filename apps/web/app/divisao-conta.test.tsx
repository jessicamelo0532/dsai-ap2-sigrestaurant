// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DivisaoConta } from './divisao-conta';
import { setMode } from '@/lib/store';
import { STORAGE_KEY } from '@/lib/local-store';
import type { Order } from '@/lib/types';

const order: Order = {
  id: 10, tableNumber: 1, status: 'OPEN', openedAt: '2026-11-19T12:00:00.000Z',
  items: [
    { id: 1, menuItemId: 1, nameSnapshot: 'Moqueca', unitPrice: '45.00', quantity: 1 },
    { id: 2, menuItemId: 2, nameSnapshot: 'Suco', unitPrice: '7.50', quantity: 2 },
  ],
};

function seed() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    zones: [{ id: 1, name: 'Salão', sortOrder: 1 }],
    tables: [{ id: 1, number: 1, capacity: 4, zoneId: 1 }],
    menu: [],
    orders: [{ ...order, tableId: 1 }],
    expenses: [],
    events: [],
  }));
}

beforeEach(() => { window.localStorage.clear(); setMode('local'); seed(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); setMode('local'); });

describe('divisão por igual (RF-01, CA-01, CA-04)', () => {
  it('cria duas parcelas, paga uma a uma e fecha a comanda', async () => {
    const onChanged = vi.fn();
    const onClosed = vi.fn();
    render(<DivisaoConta order={order} onChanged={onChanged} onClosed={onClosed} onCancel={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Dividir por igual/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pagar Pessoa 1' })).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Forma de pagamento'), { target: { value: 'CASH' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pagar Pessoa 1' }));
    await waitFor(() => expect(screen.getByText('Pago em Dinheiro')).toBeTruthy());
    expect(onClosed).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Pagar Pessoa 2' }));
    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(onClosed.mock.calls[0][0].status).toBe('PAID');
    expect(onChanged).toHaveBeenCalled();
  });
});

describe('divisão por item (RF-02, CA-02)', () => {
  it('atribui cada linha a uma pessoa e soma os valores', async () => {
    render(<DivisaoConta order={order} onChanged={() => {}} onClosed={() => {}} onCancel={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Por item' }));
    fireEvent.change(screen.getByLabelText('Pessoa do item Suco'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /Dividir por item/ }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Pagar Pessoa 1' })).toBeTruthy());
    expect(screen.getByText('45.00')).toBeTruthy();
    expect(screen.getByText('15.00')).toBeTruthy();
  });
});

describe('desfazer (CA-05)', () => {
  it('remove a divisão enquanto nada foi pago', async () => {
    render(<DivisaoConta order={order} onChanged={() => {}} onClosed={() => {}} onCancel={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Dividir por igual/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Desfazer divisão/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Desfazer divisão/ }));

    await waitFor(() => expect(screen.getByText('Como você quer dividir?')).toBeTruthy());
  });
});
