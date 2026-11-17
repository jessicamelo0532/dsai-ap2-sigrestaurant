import { describe, expect, it } from 'vitest';
import { describeEvent, eventTime, freeTablesFor, mergeCandidates, MOVE_MESSAGES, sortEvents, validateReason, type OrderEvent } from './mover';
import type { Order, Table } from './types';

// SPEC/2026-11-17-mover-e-juntar-na-tela.md (T-01)
const order = (id: number, tableNumber: number, status: Order['status'] = 'OPEN'): Order => ({
  id, tableNumber, status, openedAt: '2026-11-17T12:00:00.000Z', items: [],
});

const tables: Table[] = [
  { id: 3, number: 3, capacity: 4, order: order(30, 3) },
  { id: 1, number: 1, capacity: 4, order: order(10, 1) },
  { id: 5, number: 5, capacity: 2, order: null },
  { id: 2, number: 2, capacity: 2, order: null },
];

describe('motivo (RN-01)', () => {
  it('aceita de 3 a 200 caracteres depois de limpar espaços', () => {
    expect(validateReason(' Cliente   pediu janela ')).toBeNull();
    expect(validateReason('ok ')).toBe(MOVE_MESSAGES.reason);
    expect(validateReason('x'.repeat(201))).toBe(MOVE_MESSAGES.reason);
  });
});

describe('candidatas (RF-01, RF-02, RF-05)', () => {
  it('mesas livres, menos a atual, por número', () => {
    expect(freeTablesFor(tables, 1).map((table) => table.number)).toEqual([2, 5]);
    expect(freeTablesFor(tables.filter((table) => table.order), 1)).toEqual([]);
  });

  it('outras comandas abertas, por número', () => {
    expect(mergeCandidates(tables, 10).map((table) => table.number)).toEqual([3]);
    expect(mergeCandidates([...tables, { id: 9, number: 9, capacity: 2, order: order(90, 9, 'PAID') }], 30).map((t) => t.number)).toEqual([1]);
  });

  it('mensagem de mesa ocupada', () => {
    expect(MOVE_MESSAGES.occupied(4)).toBe('A mesa 4 já tem uma comanda aberta. Junte as contas em vez de transferir.');
  });
});

describe('histórico (RF-03)', () => {
  const base: OrderEvent = { id: 1, orderId: 10, type: 'TRANSFER', fromTableNumber: 3, toTableNumber: 5, sourceOrderId: null, reason: 'Janela', createdAt: '2026-11-17T12:00:00.000Z' };

  it('descreve transferência e os dois lados da junção', () => {
    expect(describeEvent(base)).toBe('Transferida da mesa 03 para a mesa 05');
    expect(describeEvent({ ...base, type: 'MERGE', fromTableNumber: 4, toTableNumber: 1, sourceOrderId: 12 })).toBe('Recebeu a comanda #12 da mesa 04');
    expect(describeEvent({ ...base, orderId: 12, type: 'MERGE', fromTableNumber: 4, toTableNumber: 1, sourceOrderId: 12 })).toBe('Juntada à comanda da mesa 01');
    expect(describeEvent({ ...base, fromTableNumber: null })).toBe('Transferida da mesa removida para a mesa 05');
  });

  it('ordena e formata a hora', () => {
    const later = { ...base, id: 2, createdAt: '2026-11-17T13:00:00.000Z' };
    expect(sortEvents([later, base]).map((event) => event.id)).toEqual([1, 2]);
    expect(eventTime(new Date(2026, 10, 17, 9, 5).toISOString())).toBe('17/11 09:05');
    expect(eventTime('x')).toBe('');
  });
});
