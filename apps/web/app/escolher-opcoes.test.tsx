// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { EscolherOpcoes } from './escolher-opcoes';
import { stubApi } from '@/test/api';
import { setMode } from '@/lib/store';
import type { MenuItem } from '@/lib/types';

const item: MenuItem = { id: 1, name: 'Pizza', price: '40.00', categoryId: 1, active: true };
const options = {
  variants: [
    { id: 10, name: 'Média', price: '40.00' },
    { id: 11, name: 'Grande', price: '55.00' },
  ],
  addons: [
    { id: 20, name: 'Borda', price: '8.00' },
  ],
};

beforeEach(() => { setMode('api'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('EscolherOpcoes (RF-05, CA-05)', () => {
  it('abre e calcula o preço corretamente', async () => {
    stubApi({ 'GET /menu-items/1/options': () => ({ body: options }) });
    const onDone = vi.fn();
    render(<EscolherOpcoes item={item} quantity={2} onDone={onDone} onCancel={() => {}} />);

    // Espera carregar e mostrar o componente
    await screen.findByRole('dialog', { name: /Opções de Pizza/ });

    // Seleciona variação Grande (55.00) e adicional Borda (8.00) = 63.00
    // Quantidade 2 -> Total 126.00
    fireEvent.click(screen.getByText('Grande'));
    fireEvent.click(screen.getByText('Borda'));

    const total = screen.getByLabelText('Preço da linha');
    expect(total.textContent).toContain('126,00');
  });

  it('valida obrigatoriedade da variação', async () => {
    stubApi({ 'GET /menu-items/1/options': () => ({ body: options }) });
    render(<EscolherOpcoes item={item} quantity={1} onDone={() => {}} onCancel={() => {}} />);
    
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    
    expect(screen.getByRole('alert').textContent).toContain('Escolha a variação de Pizza');
  });
});
