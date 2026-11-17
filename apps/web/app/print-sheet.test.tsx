// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PrintSheet } from './print-sheet';
import { buildBobina, buildCupom } from '@/lib/impressao';
import { money } from '@/lib/format';

const brl = (value: string | number) => money(value).replace(/\u00a0/g, ' ');
import type { Order } from '@/lib/types';

const openedAt = new Date(2026, 10, 17, 19, 30).toISOString();
const paidAt = new Date(2026, 10, 17, 20, 15).toISOString();

const order: Order = {
  id: 10,
  tableNumber: 3,
  status: 'OPEN',
  openedAt,
  items: [
    { id: 1, menuItemId: 1, nameSnapshot: 'Açaí', unitPrice: '18.00', quantity: 2 },
    { id: 2, menuItemId: 2, nameSnapshot: 'Suco', unitPrice: '7.50', quantity: 1 },
  ],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('bobina da comanda (RF-01 e RF-03)', () => {
  it('mostra identificação, itens, quantidades e total', () => {
    render(<PrintSheet doc={buildBobina(order)} onClose={() => {}} />);

    expect(screen.getByRole('dialog', { name: 'Bobina da comanda' })).toBeTruthy();
    expect(screen.getByText('Mesa Clara')).toBeTruthy();
    expect(screen.getAllByText('COMANDA')).toHaveLength(2);
    expect(screen.getByText('Mesa 03')).toBeTruthy();
    expect(screen.getByText('2× Açaí')).toBeTruthy();
    expect(screen.getByText('1× Suco')).toBeTruthy();
    expect(screen.getByText(brl(36))).toBeTruthy();
    expect(screen.getAllByText(brl(43.5)).length).toBeGreaterThan(0);
    expect(screen.getByText('Aberta em 17/11/2026 19:30 · 3 itens')).toBeTruthy();
  });

  it('leva a observação quando existe', () => {
    render(<PrintSheet doc={buildBobina(order, 'sem cebola')} onClose={() => {}} />);
    expect(screen.getByText('Observação: sem cebola')).toBeTruthy();
  });

  it('avisa quando a comanda está sem itens', () => {
    render(<PrintSheet doc={buildBobina({ ...order, items: [] })} onClose={() => {}} />);
    expect(screen.getByText('Nenhum item')).toBeTruthy();
  });
});

describe('cupom da conta (RF-02)', () => {
  it('mostra forma de pagamento, total e data', () => {
    render(<PrintSheet doc={buildCupom({ ...order, status: 'PAID', paymentMethod: 'PIX', paidAt })} onClose={() => {}} />);

    expect(screen.getByRole('dialog', { name: 'Cupom da conta' })).toBeTruthy();
    expect(screen.getAllByText('CONTA FECHADA')).toHaveLength(2);
    expect(screen.getByText('Pagamento: Pix')).toBeTruthy();
    expect(screen.getByText('Pago em 17/11/2026 20:15')).toBeTruthy();
    expect(screen.getByText('Comanda 10')).toBeTruthy();
    expect(screen.getAllByText(brl(43.5)).length).toBeGreaterThan(0);
  });
});

describe('impressão e fechamento (RF-03 e RF-04)', () => {
  it('chama window.print ao clicar em imprimir', () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    render(<PrintSheet doc={buildBobina(order)} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('fecha pelo botão e pelo fundo', () => {
    const onClose = vi.fn();
    const { container } = render(<PrintSheet doc={buildBobina(order)} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(container.querySelector('.print-backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('marca a prévia e as ações como fora da impressão (RF-04)', () => {
    render(<PrintSheet doc={buildBobina(order)} onClose={() => {}} />);
    expect(document.querySelector('.print-sheet')).toBeTruthy();
    expect(document.querySelector('.modal-heading')?.classList.contains('no-print')).toBe(true);
    expect(document.querySelector('.form-actions')?.classList.contains('no-print')).toBe(true);
  });
});
