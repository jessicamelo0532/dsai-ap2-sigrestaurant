// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RelatorioEvolucaoDiaria } from './relatorio-evolucao-diaria';
import { reportForPeriod, type PaidSale } from '@/lib/sales-report';

const line = (name: string, category: string, quantity: number, unitPriceCents: number) => ({
  key: `${name}|${category}`, name, category, quantity, unitPriceCents,
});
const sale = (paidAt: string, paymentMethod: PaidSale['paymentMethod'], lines: PaidSale['lines']): PaidSale => ({
  paidAt: new Date(paidAt), paymentMethod, lines,
});

const report = reportForPeriod([
  sale('2026-11-25T13:00:00Z', 'PIX', [line('Pizza', 'Pratos', 2, 3000)]),
  sale('2026-11-26T13:00:00Z', 'CASH', [line('Suco', 'Bebidas', 1, 900)]),
], '2026-11-24', '2026-11-26');

afterEach(() => { document.body.innerHTML = ''; });

describe('RelatorioEvolucaoDiaria', () => {
  it('mostra resumo, gráfico e uma linha por dia com venda', () => {
    const { container } = render(<RelatorioEvolucaoDiaria report={report} />);
    expect(screen.getByText('Como as vendas caminharam')).toBeTruthy();
    expect(screen.getByText('Melhor dia')).toBeTruthy();
    expect(screen.getAllByText('25/11').length).toBeGreaterThan(0);

    const table = screen.getByRole('table', { name: 'Evolução diária' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('25/11')).toBeTruthy();
    expect(within(table).getByText('26/11')).toBeTruthy();

    expect(screen.getByRole('img', { name: 'Receita por dia no período' })).toBeTruthy();
    expect(container.querySelectorAll('.daily-line')).toHaveLength(1);
    expect(container.querySelectorAll('.daily-area')).toHaveLength(1);
    expect(container.querySelectorAll('.daily-dot')).toHaveLength(2);
  });

  it('alterna a métrica entre receita e contas', () => {
    render(<RelatorioEvolucaoDiaria report={report} />);
    fireEvent.click(screen.getByRole('button', { name: 'Contas' }));
    expect(screen.getByRole('img', { name: 'Contas pagas por dia no período' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Contas' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('mostra estado vazio sem dias', () => {
    render(<RelatorioEvolucaoDiaria report={reportForPeriod([], '2026-11-24', '2026-11-26')} />);
    expect(screen.getByText('Nenhuma venda no período')).toBeTruthy();
  });
});
