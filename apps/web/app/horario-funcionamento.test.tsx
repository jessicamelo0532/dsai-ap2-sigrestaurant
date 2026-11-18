// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api'; });

import { HorarioFuncionamento } from './horario-funcionamento';
import { ReservasPanel } from './reservas-panel';
import { setMode } from '@/lib/store';

// SPEC/2026-11-17-horario-de-funcionamento.md (T-03, CA-06)
import { stubApi } from '@/test/api';
const friday = { configured: true, windows: [{ weekday: 5, day: 'sexta-feira', start: '18:00', end: '23:00' }] };
const none = { configured: false, windows: [] };

beforeEach(() => { window.localStorage.clear(); setMode('api'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); setMode('api'); });

describe('horário de funcionamento (CA-06)', () => {
  it('carrega as janelas cadastradas', async () => {
    stubApi({ 'GET /opening-hours': () => ({ body: friday }) });
    render(<HorarioFuncionamento onClose={() => {}} />);

    const list = await screen.findByRole('list', { name: 'Janelas de funcionamento' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect((screen.getByLabelText('Início da janela 1') as HTMLInputElement).value).toBe('18:00');
    expect(screen.getByText('As reservas só são aceitas quando cabem inteiras numa janela do dia.')).toBeTruthy();
  });

  it('inclui, repete nos dias úteis e salva', async () => {
    const calls = stubApi({
      'GET /opening-hours': () => ({ body: none }),
      'PUT /opening-hours': () => ({ body: friday }),
    });
    render(<HorarioFuncionamento onClose={() => {}} />);

    expect(await screen.findByText('Sem horário cadastrado, as reservas são aceitas em qualquer horário.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Incluir janela/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Repetir a janela 1 nos dias úteis' }));
    fireEvent.click(screen.getByRole('button', { name: /Salvar horário/ }));

    expect((await screen.findByRole('status')).textContent).toBe('Pronto, horário de funcionamento salvo.');
    expect((calls.find((c) => c.method === 'PUT')?.body as { windows: unknown[] }).windows).toHaveLength(5);
  });

  it('recusa janelas sobrepostas sem enviar', async () => {
    const calls = stubApi({ 'GET /opening-hours': () => ({ body: friday }) });
    render(<HorarioFuncionamento onClose={() => {}} />);

    await screen.findByRole('list', { name: 'Janelas de funcionamento' });
    fireEvent.click(screen.getByRole('button', { name: /Incluir janela/ }));
    fireEvent.change(screen.getByLabelText('Dia da janela 2'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Início da janela 2'), { target: { value: '22:00' } });
    fireEvent.change(screen.getByLabelText('Fim da janela 2'), { target: { value: '24:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar horário/ }));

    expect(screen.getByRole('alert').textContent).toBe('As janelas de sexta-feira se sobrepõem.');
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('sem horário envia a lista vazia', async () => {
    const calls = stubApi({ 'GET /opening-hours': () => ({ body: friday }), 'PUT /opening-hours': () => ({ body: none }) });
    render(<HorarioFuncionamento onClose={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: /Sem horário/ }));
    fireEvent.click(screen.getByRole('button', { name: /Salvar horário/ }));

    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ windows: [] }));
    expect((await screen.findByRole('status')).textContent).toBe('Pronto: sem horário cadastrado, as reservas valem para qualquer horário.');
  });

  it('mostra o erro da API ao carregar', async () => {
    stubApi({ 'GET /opening-hours': () => ({ body: { message: 'Falha no banco' }, status: 500 }) });
    render(<HorarioFuncionamento onClose={() => {}} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Falha no banco');
  });
});

describe('botão na seção Reservas', () => {
  it('abre o horário de funcionamento', async () => {
    stubApi({ 'GET /reservations': () => ({ body: [] }), 'GET /opening-hours': () => ({ body: friday }) });
    render(<ReservasPanel mode="api" canConnect onConnect={() => {}} onOpenTable={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Horário de funcionamento/ }));
    expect(await screen.findByRole('dialog', { name: 'Horário de funcionamento' })).toBeTruthy();
  });
});
