// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QrMesas } from './qr-mesas';
import { encodeQr, qrPath } from '@/lib/qrcode';

// SPEC/2026-11-17-pwa-e-qr-das-mesas.md (T-04)

const tables = [
  { id: 3, number: 12, capacity: 4 },
  { id: 1, number: 2, capacity: 2 },
];

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('QR das mesas (CA-04)', () => {
  it('um cartão por mesa, em ordem, com o QR do endereço da mesa', () => {
    render(<QrMesas tables={tables} origin="https://mesa.test" onClose={() => {}} />);

    const cards = screen.getAllByRole('article');
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual(['QR da Mesa 02', 'QR da Mesa 12']);
    expect(within(cards[0]).getByText('https://mesa.test/?mesa=2')).toBeTruthy();
    const path = cards[0].querySelector('path')?.getAttribute('d');
    expect(path).toBe(qrPath(encodeQr('https://mesa.test/?mesa=2')));
    expect(within(cards[1]).getByRole('img', { name: 'QR code que abre a Mesa 12' })).toBeTruthy();
  });

  it('imprime e fecha', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const onClose = vi.fn();
    render(<QrMesas tables={tables} origin="https://mesa.test" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Imprimir/ }));
    expect(print).toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Fechar' }).find((button) => button.textContent === 'Fechar')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('sem mesas, avisa e não imprime', () => {
    render(<QrMesas tables={[]} origin="https://mesa.test" onClose={() => {}} />);
    expect(screen.getByText('Nenhuma mesa cadastrada.')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Imprimir/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
