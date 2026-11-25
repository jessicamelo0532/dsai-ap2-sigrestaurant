// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HelpAgent } from './help-agent';

// SPEC/2026-11-25-assistente-de-ajuda.md (CA-01 a CA-06).
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function open(section: 'operacao' | 'caixa' = 'operacao') {
  const onNavigate = vi.fn();
  render(<HelpAgent section={section} onNavigate={onNavigate} />);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir ajuda guiada' }));
  return { onNavigate };
}

describe('painel de ajuda', () => {
  it('abre só ao clicar e fecha com Esc', () => {
    render(<HelpAgent section="operacao" onNavigate={() => {}} />);
    expect(screen.queryByRole('dialog', { name: 'Como podemos ajudar?' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir ajuda guiada' }));
    expect(screen.getByRole('dialog', { name: 'Como podemos ajudar?' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Como podemos ajudar?' })).toBeNull();
  });

  it('sugere o assunto da seção atual', () => {
    open('caixa');
    expect(screen.getByRole('button', { name: /Receber e conferir o caixa/ })).toBeTruthy();
  });

  it('busca sem acento, mostra passos, fonte e navega para a seção', () => {
    const { onNavigate } = open();
    fireEvent.change(screen.getByLabelText('Buscar na ajuda'), { target: { value: 'FECHAR CONTÁ' } });
    fireEvent.click(screen.getByRole('button', { name: /Fechar conta e pagar/ }));

    expect(screen.getByText(/Fonte: SPEC\/2026-11-16-caixa-por-turno/)).toBeTruthy();
    expect(screen.getByText(/Escolha a forma de pagamento/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Ir para Visão geral/ }));
    expect(onNavigate).toHaveBeenCalledWith('operacao');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('mostra fallback sem chamada de rede quando não encontra', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    open();

    fireEvent.change(screen.getByLabelText('Buscar na ajuda'), { target: { value: 'xyzabc' } });
    expect(screen.getByRole('status').textContent).toContain('Não encontrei esse assunto');
    expect(screen.getByRole('button', { name: /Abrir mesa e começar a comanda/ })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
