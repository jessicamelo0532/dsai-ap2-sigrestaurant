// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api'; });

import { ReservasPanel } from './reservas-panel';
import type { Reservation } from '@/lib/reservas';
import { stubApi } from '@/test/api';
const base: Reservation[] = [
  { id: 1, tableId: 3, tableNumber: 3, customerName: 'Ana', customerPhone: '9199', partySize: 2, startsAt: '2026-11-17T19:00:00.000Z', endsAt: '2026-11-17T21:00:00.000Z', status: 'BOOKED', notes: null },
  { id: 2, tableId: 4, tableNumber: 4, customerName: 'Bia', customerPhone: null, partySize: 4, startsAt: '2026-11-17T20:00:00.000Z', endsAt: '2026-11-17T22:00:00.000Z', status: 'SEATED', notes: 'aniversário' },
  { id: 3, tableId: 5, tableNumber: 5, customerName: 'Cai', customerPhone: null, partySize: 1, startsAt: '2026-11-17T18:00:00.000Z', endsAt: '2026-11-17T20:00:00.000Z', status: 'CANCELLED', notes: null },
];

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('lista e filtros (RF-01, RF-02)', () => {
  it('mostra as reservas do dia com situação', async () => {
    stubApi({ 'GET /reservations': () => ({ body: base }) });
    render(<ReservasPanel mode="api" canConnect onConnect={() => {}} onOpenTable={() => {}} />);
    expect(await screen.findByText('Ana')).toBeTruthy();
    expect(screen.getByText('Bia')).toBeTruthy();
    expect(screen.getByText('Agendada')).toBeTruthy();
    expect(screen.getAllByText('Cliente chegou').length).toBeGreaterThan(0);
    expect(screen.getByText('Mesa 03')).toBeTruthy();
  });

  it('filtra por situação', async () => {
    stubApi({ 'GET /reservations': () => ({ body: base }) });
    render(<ReservasPanel mode="api" canConnect onConnect={() => {}} onOpenTable={() => {}} />);
    await screen.findByText('Ana');
    fireEvent.click(screen.getByRole('button', { name: /^Agendadas/ }));
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.queryByText('Bia')).toBeNull();
  });
});

describe('ações (RF-05, RF-06)', () => {
  it('assenta e oferece abrir comanda', async () => {
    const onOpen = vi.fn();
    const calls = stubApi({
      'GET /reservations': () => ({ body: base }),
      'POST /reservations/1/seat': () => ({ body: { ...base[0], status: 'SEATED' } }),
    });
    render(<ReservasPanel mode="api" canConnect onConnect={() => {}} onOpenTable={onOpen} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Assentar' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.includes('/seat'))).toBe(true));
    const openButtons = await screen.findAllByRole('button', { name: 'Abrir comanda' });
    fireEvent.click(openButtons[0]);
    expect(onOpen).toHaveBeenCalledWith(3);
  });

  it('cancela a reserva', async () => {
    const calls = stubApi({
      'GET /reservations': () => ({ body: base }),
      'POST /reservations/1/cancel': () => ({ body: { ...base[0], status: 'CANCELLED' } }),
    });
    render(<ReservasPanel mode="api" canConnect onConnect={() => {}} onOpenTable={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(calls.some((c) => c.path.includes('/cancel'))).toBe(true));
  });

  it('mostra erro da API (conflito)', async () => {
    stubApi({
      'GET /reservations': () => ({ body: base }),
      'POST /reservations/1/seat': () => ({ status: 400, body: { message: 'O horário desta reserva já terminou.' } }),
    });
    render(<ReservasPanel mode="api" canConnect onConnect={() => {}} onOpenTable={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Assentar' }));
    expect(await screen.findByText('O horário desta reserva já terminou.')).toBeTruthy();
  });
});

describe('criar reserva (RF-03, RF-04)', () => {
  it('busca mesas livres e cria', async () => {
    const calls = stubApi({
      'GET /reservations': () => ({ body: [] }),
      'GET /reservations/availability': () => ({ body: [{ id: 3, number: 3, capacity: 4 }] }),
      'POST /reservations': () => ({ body: { ...base[0], id: 9 } }),
    });
    render(<ReservasPanel mode="api" canConnect onConnect={() => {}} onOpenTable={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /Nova reserva/ }));
    fireEvent.change(screen.getByPlaceholderText('Ex.: Ana'), { target: { value: 'Carlos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar mesas livres' }));
    expect(await screen.findByLabelText('Mesa livre')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Mesa livre'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar reserva' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/reservations')).toBe(true));
  });

  it('mostra conflito ao criar', async () => {
    stubApi({
      'GET /reservations': () => ({ body: [] }),
      'GET /reservations/availability': () => ({ body: [{ id: 3, number: 3, capacity: 4 }] }),
      'POST /reservations': () => ({ status: 400, body: { message: 'A mesa 3 já está reservada nesse horário.' } }),
    });
    render(<ReservasPanel mode="api" canConnect onConnect={() => {}} onOpenTable={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /Nova reserva/ }));
    fireEvent.change(screen.getByPlaceholderText('Ex.: Ana'), { target: { value: 'Carlos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar mesas livres' }));
    await screen.findByLabelText('Mesa livre');
    fireEvent.change(screen.getByLabelText('Mesa livre'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar reserva' }));
    expect(await screen.findByText('A mesa 3 já está reservada nesse horário.')).toBeTruthy();
  });
});

describe('modo navegador (RF-08)', () => {
  it('mostra aviso e não chama a API', () => {
    const calls = stubApi({});
    render(<ReservasPanel mode="local" canConnect onConnect={() => {}} onOpenTable={() => {}} />);
    expect(screen.getByText('Reservas precisam do servidor')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});
