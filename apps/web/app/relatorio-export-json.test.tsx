// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RelatorioExportJson } from './relatorio-export-json';
import { reportForPeriod, type PaidSale } from '@/lib/sales-report';

const line = (name: string, category: string, quantity: number, unitPriceCents: number) => ({
  key: `${name}|${category}`, name, category, quantity, unitPriceCents,
});
const sale = (paidAt: string, paymentMethod: PaidSale['paymentMethod'], lines: PaidSale['lines']): PaidSale => ({
  paidAt: new Date(paidAt), paymentMethod, lines,
});

const current = reportForPeriod([
  sale('2026-11-25T13:00:00Z', 'PIX', [line('Pizza', 'Pratos', 2, 3000)]),
], '2026-11-25', '2026-11-25');
const previous = reportForPeriod([
  sale('2026-11-24T13:00:00Z', 'CASH', [line('Pizza', 'Pratos', 1, 3000)]),
], '2026-11-24', '2026-11-24');

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('RelatorioExportJson', () => {
  it('abre o overlay com o JSON formatado', () => {
    render(<RelatorioExportJson current={current} previous={previous} />);
    fireEvent.click(screen.getByRole('button', { name: /Exportar JSON/ }));

    expect(screen.getByRole('dialog', { name: 'Exportação JSON' })).toBeTruthy();
    const content = screen.getByLabelText('Conteúdo JSON');
    expect(content.textContent).toContain('"from": "2026-11-25"');
    expect(content.textContent).toContain('"categories"');
    expect(content.textContent).toContain('"hasPrevious": true');
  });

  it('copia o JSON para a área de transferência', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<RelatorioExportJson current={current} previous={previous} />);
    fireEvent.click(screen.getByRole('button', { name: /Exportar JSON/ }));
    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Copiado')).toBeTruthy();
  });

  it('baixa o JSON com o nome do período', () => {
    const createObjectURL = vi.fn(() => 'blob:json');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<RelatorioExportJson current={current} previous={previous} />);
    fireEvent.click(screen.getByRole('button', { name: /Exportar JSON/ }));
    fireEvent.click(screen.getByRole('button', { name: /Baixar JSON/ }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('fecha a prévia', () => {
    const onClose = vi.fn();
    render(<RelatorioExportJson current={current} previous={previous} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Exportar JSON/ }));
    fireEvent.click(screen.getByRole('button', { name: /Fechar/ }));
    expect(screen.queryByRole('dialog', { name: 'Exportação JSON' })).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mantém o botão desabilitado sem relatório', () => {
    render(<RelatorioExportJson current={null} previous={null} />);
    expect((screen.getByRole('button', { name: /Exportar JSON/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
