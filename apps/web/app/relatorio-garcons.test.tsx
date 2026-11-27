// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RelatorioGarcons } from './relatorio-garcons';
import { reportForPeriod, type PaidSale } from '@/lib/sales-report';

const line = (name: string, category: string, quantity: number, unitPriceCents: number) => ({
  key: `${name}|${category}`, name, category, quantity, unitPriceCents,
});
const sale = (paidAt: string, paymentMethod: PaidSale['paymentMethod'], lines: PaidSale['lines'], waiterName?: string): PaidSale => ({
  paidAt: new Date(paidAt), paymentMethod, lines, waiterName,
});

const report = reportForPeriod([
  sale('2026-11-25T13:00:00Z', 'PIX', [line('Pizza', 'Pratos', 2, 3000)], 'Ana'),
  sale('2026-11-25T14:00:00Z', 'CASH', [line('Suco', 'Bebidas', 1, 900)], 'Ana'),
  sale('2026-11-25T15:00:00Z', 'PIX', [line('Pizza', 'Pratos', 1, 3000)], 'Bruno'),
], '2026-11-25', '2026-11-25');

afterEach(() => { document.body.innerHTML = ''; });

describe('RelatorioGarcons', () => {
  it('mostra pódio, resumo e tabela por garçom', () => {
    render(<RelatorioGarcons report={report} />);
    expect(screen.getByText('Desempenho por garçom')).toBeTruthy();
    expect(screen.getByLabelText('Pódio de garçons')).toBeTruthy();
    expect(screen.getAllByText('Ana').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bruno').length).toBeGreaterThan(0);

    const table = screen.getByRole('table', { name: 'Garçons por receita' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getAllByText('R$ 69,00').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('R$ 30,00').length).toBeGreaterThan(0);
  });

  it('alterna a ordenação entre receita, contas e ticket', () => {
    render(<RelatorioGarcons report={report} />);
    fireEvent.click(screen.getByRole('button', { name: 'Contas' }));
    expect(screen.getByRole('table', { name: 'Garçons por contas' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ticket' }));
    expect(screen.getByRole('table', { name: 'Garçons por ticket médio' })).toBeTruthy();
  });

  it('mostra estado vazio sem garçons', () => {
    render(<RelatorioGarcons report={reportForPeriod([], '2026-11-25', '2026-11-25')} />);
    expect(screen.getByText('Nenhum garçom no período')).toBeTruthy();
  });
});
