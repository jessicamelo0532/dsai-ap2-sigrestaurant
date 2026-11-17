// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SalaoPanel } from './salao-panel';
import { FLOOR_REFRESH_MS } from '@/lib/salao';
import type { Table } from '@/lib/types';

const openTable = (minutes: number): Table => ({
  id: 2,
  number: 2,
  capacity: 2,
  order: {
    id: 10,
    tableNumber: 2,
    status: 'OPEN',
    openedAt: new Date(Date.now() - minutes * 60_000).toISOString(),
    items: [
      { id: 1, menuItemId: 1, nameSnapshot: 'Açaí', unitPrice: '18.00', quantity: 2 },
      { id: 2, menuItemId: 2, nameSnapshot: 'Suco', unitPrice: '7.50', quantity: 1 },
    ],
  },
});

const freeTable: Table = { id: 1, number: 1, capacity: 4, order: null };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('visão do salão (RF-01 a RF-04)', () => {
  it('resume mesas ocupadas, livres e o total em aberto', () => {
    render(<SalaoPanel tables={[freeTable, openTable(30)]} onOpenTable={() => {}} onRefresh={() => {}} />);

    expect(screen.getByText('1 de 2')).toBeTruthy();
    expect(screen.getByText('1 livres')).toBeTruthy();
    expect(screen.getAllByText('R$ 43,50')).toHaveLength(2);
    expect(screen.getAllByText('Mesa 02')).toHaveLength(2);
    expect(screen.getByText('aberta há 30 min')).toBeTruthy();
  });

  it('mostra o que a mesa pediu, a conta e o tempo', () => {
    render(<SalaoPanel tables={[openTable(5)]} onOpenTable={() => {}} onRefresh={() => {}} />);

    expect(screen.getByLabelText('Mesa 02, ocupada')).toBeTruthy();
    expect(screen.getByText('Conta aberta')).toBeTruthy();
    expect(screen.getByText('Açaí')).toBeTruthy();
    expect(screen.getByText('2×')).toBeTruthy();
    expect(screen.getByText('3 itens · 2 lugares')).toBeTruthy();
    expect(screen.getAllByText('R$ 43,50')).toHaveLength(2);
  });

  it('abre a comanda da mesa ocupada', () => {
    const onOpenTable = vi.fn();
    render(<SalaoPanel tables={[openTable(5)]} onOpenTable={onOpenTable} onRefresh={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Ver comanda/ }));
    expect(onOpenTable).toHaveBeenCalledWith(2);
  });

  it('lança pedido na mesa livre', () => {
    const onOpenTable = vi.fn();
    render(<SalaoPanel tables={[freeTable]} onOpenTable={onOpenTable} onRefresh={() => {}} />);

    expect(screen.getByLabelText('Mesa 01, livre')).toBeTruthy();
    expect(screen.getByText('Livre · 4 lugares')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Lançar pedido/ }));
    expect(onOpenTable).toHaveBeenCalledWith(1);
  });

  it('filtra por livres e por ocupadas', () => {
    render(<SalaoPanel tables={[freeTable, openTable(5)]} onOpenTable={() => {}} onRefresh={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /^Livres/ }));
    expect(screen.getByLabelText('Mesa 01, livre')).toBeTruthy();
    expect(screen.queryByLabelText('Mesa 02, ocupada')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Ocupadas/ }));
    expect(screen.getByLabelText('Mesa 02, ocupada')).toBeTruthy();
    expect(screen.queryByLabelText('Mesa 01, livre')).toBeNull();
  });

  it('explica o salão vazio e o filtro sem mesas', () => {
    const { unmount } = render(<SalaoPanel tables={[]} onOpenTable={() => {}} onRefresh={() => {}} />);
    expect(screen.getByText('O salão está vazio')).toBeTruthy();
    unmount();

    render(<SalaoPanel tables={[freeTable]} onOpenTable={() => {}} onRefresh={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Ocupadas/ }));
    expect(screen.getByText('Nenhuma mesa neste filtro')).toBeTruthy();
  });

  it('recarrega sozinho enquanto a tela está aberta (RF-09)', () => {
    vi.useFakeTimers();
    const onRefresh = vi.fn();
    render(<SalaoPanel tables={[freeTable]} onOpenTable={() => {}} onRefresh={onRefresh} />);

    expect(onRefresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(FLOOR_REFRESH_MS);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
