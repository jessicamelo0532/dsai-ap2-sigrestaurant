// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RelatorioImpresso } from './relatorio-impresso';
import { reportForPeriod, type PaidSale } from '@/lib/sales-report';

const line = (name: string, category: string, quantity: number, unitPriceCents: number) => ({
  key: `${name}|${category}`, name, category, quantity, unitPriceCents,
});
const sale = (paidAt: string, paymentMethod: PaidSale['paymentMethod'], lines: PaidSale['lines']): PaidSale => ({
  paidAt: new Date(paidAt), paymentMethod, lines,
});

const report = reportForPeriod([
  sale('2026-11-25T13:00:00Z', 'PIX', [line('Pizza', 'Pratos', 3, 3000), line('Suco', 'Bebidas', 1, 1000)]),
], '2026-11-25', '2026-11-25');
const previous = reportForPeriod([
  sale('2026-11-24T13:00:00Z', 'CASH', [line('Pizza', 'Pratos', 1, 3000)]),
], '2026-11-24', '2026-11-24');

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('RelatorioImpresso', () => {
  it('mostra cabeçalho, resumo e tabelas do período', () => {
    render(<RelatorioImpresso report={report} previous={previous} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Relatório para impressão' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Relatório de vendas' })).toBeTruthy();
    expect(screen.getByText(/Período de 2026-11-25 a 2026-11-25/)).toBeTruthy();
    expect(screen.getByText('Receita líquida')).toBeTruthy();
    expect(screen.getByText('Itens de maior receita')).toBeTruthy();
    expect(screen.getByText('Receita por categoria')).toBeTruthy();
    expect(screen.getByText('Formas de pagamento')).toBeTruthy();
    expect(screen.getByText('Dias da semana')).toBeTruthy();
    expect(screen.getByText('Horários de maior receita')).toBeTruthy();
    expect(screen.getByText('Leitura do período')).toBeTruthy();
  });

  it('mostra apenas as seis melhores horas', () => {
    render(<RelatorioImpresso report={report} previous={previous} onClose={() => {}} />);
    const section = screen.getByText('Horários de maior receita').closest('section');
    expect(section).toBeTruthy();
    expect(within(section as HTMLElement).getAllByRole('row')).toHaveLength(7);
    expect(within(section as HTMLElement).getByText('10h')).toBeTruthy();
  });

  it('imprime e fecha a prévia', () => {
    const print = vi.fn();
    Object.defineProperty(window, 'print', { configurable: true, value: print });
    const onClose = vi.fn();
    render(<RelatorioImpresso report={report} previous={previous} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    expect(print).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Fechar/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
