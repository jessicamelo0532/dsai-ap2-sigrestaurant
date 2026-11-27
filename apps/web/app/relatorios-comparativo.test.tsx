// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RelatoriosComparativo } from './relatorios-comparativo';
import { reportForPeriod, type PaidSale } from '@/lib/sales-report';

const line = (name: string, category: string, quantity: number, unitPriceCents: number) => ({
  key: `${name}|${category}`, name, category, quantity, unitPriceCents,
});
const sale = (paidAt: string, paymentMethod: PaidSale['paymentMethod'], lines: PaidSale['lines']): PaidSale => ({
  paidAt: new Date(paidAt), paymentMethod, lines,
});

const current = reportForPeriod([
  sale('2026-11-25T13:00:00Z', 'PIX', [line('Pizza', 'Pratos', 3, 3000), line('Suco', 'Bebidas', 1, 1000)]),
  sale('2026-11-25T14:00:00Z', 'CASH', [line('Pizza', 'Pratos', 1, 3000)]),
], '2026-11-25', '2026-11-25');
const previous = reportForPeriod([
  sale('2026-11-24T13:00:00Z', 'PIX', [line('Pizza', 'Pratos', 1, 3000)]),
], '2026-11-24', '2026-11-24');

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('RelatoriosComparativo', () => {
  it('mostra totais, categorias, pagamentos e dias', () => {
    render(<RelatoriosComparativo current={current} previous={previous} />);
    expect(screen.getByRole('heading', { name: 'Comparativo detalhado' })).toBeTruthy();
    expect(screen.getByText(/Atual: 2026-11-25 a 2026-11-25/)).toBeTruthy();

    const totals = screen.getByRole('table', { name: 'Comparativo de totais' });
    expect(within(totals).getByText('Receita')).toBeTruthy();
    expect(within(totals).getAllByText('R$ 130,00').length).toBeGreaterThan(0);
    expect(within(totals).getAllByText('R$ 30,00').length).toBeGreaterThan(0);

    expect(screen.getByRole('table', { name: 'Comparativo de categorias' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Comparativo de formas de pagamento' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Comparativo por dia da semana' })).toBeTruthy();
  });

  it('mostra insights e alterna o ranking de itens', () => {
    render(<RelatoriosComparativo current={current} previous={previous} />);
    expect(screen.getByText('Receita contra o período anterior')).toBeTruthy();
    expect(screen.getByText('Categoria líder')).toBeTruthy();

    expect(screen.getByRole('table', { name: 'Comparativo de itens por receita' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Por quantidade' }));
    expect(screen.getByRole('table', { name: 'Comparativo de itens por quantidade' })).toBeTruthy();
  });

  it('exporta o comparativo em CSV', () => {
    const createObjectURL = vi.fn(() => 'blob:comparativo');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<RelatoriosComparativo current={current} previous={previous} />);
    fireEvent.click(screen.getByRole('button', { name: /Exportar comparativo/ }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
