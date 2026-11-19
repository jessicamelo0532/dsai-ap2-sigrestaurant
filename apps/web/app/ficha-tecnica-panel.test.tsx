// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FichaTecnicaPanel } from './ficha-tecnica-panel';
import { STORAGE_KEY } from '@/lib/local-store';
import type { MenuItem } from '@/lib/types';

const pizza: MenuItem = { id: 7, name: 'Pizza', description: null, category: 'Pratos', price: '40.00', available: true };

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    zones: [{ id: 1, name: 'Salão', sortOrder: 1 }],
    tables: [], menu: [pizza], orders: [], expenses: [], events: [], ingredients: [], recipes: [],
  }));
});

afterEach(() => {
  cleanup();
});

async function addIngredient(name: string, cost: string) {
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Custo (R$)'), { target: { value: cost } });
  fireEvent.click(screen.getByRole('button', { name: /Adicionar ingrediente/ }));
  await screen.findByText(name);
}

describe('ficha técnica no cardápio (SPEC/2026-11-19-ficha-tecnica-e-margem.md)', () => {
  it('cadastra ingrediente, monta a ficha e mostra custo e margem (CA-01 e CA-02)', async () => {
    render(<FichaTecnicaPanel menu={[pizza]} mode="local" canConnect onConnect={() => {}} />);

    await addIngredient('Queijo', '10.00');
    fireEvent.change(screen.getByLabelText('Ingrediente'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar à ficha/ }));

    expect(await screen.findByText(/R\$\s*20,00/)).toBeTruthy();
    expect(screen.getByText('50,0%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar ficha técnica' }));
    expect(await screen.findByText('Ficha técnica salva.')).toBeTruthy();
  });

  it('recusa ingrediente repetido na ficha (CA-04)', async () => {
    render(<FichaTecnicaPanel menu={[pizza]} mode="local" canConnect onConnect={() => {}} />);

    await addIngredient('Queijo', '10.00');
    fireEvent.change(screen.getByLabelText('Ingrediente'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar à ficha/ }));
    fireEvent.change(screen.getByLabelText('Ingrediente'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar à ficha/ }));

    expect(await screen.findByText('O ingrediente já está na ficha técnica.')).toBeTruthy();
  });

  it('bloqueia a remoção de ingrediente usado (CA-03)', async () => {
    render(<FichaTecnicaPanel menu={[pizza]} mode="local" canConnect onConnect={() => {}} />);

    await addIngredient('Queijo', '10.00');
    fireEvent.change(screen.getByLabelText('Ingrediente'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar à ficha/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar ficha técnica' }));
    await screen.findByText('Ficha técnica salva.');

    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Remover Queijo' }) as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
