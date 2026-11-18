// Transferir comanda e juntar contas pela tela (SPEC/2026-11-17-mover-e-juntar-na-tela.md).
// Funções puras usadas pelo componente da comanda e pelo adaptador local.
import type { Table } from './types';

export type OrderEventType = 'TRANSFER' | 'MERGE';

export type OrderEvent = {
  id: number;
  orderId: number;
  type: OrderEventType;
  fromTableNumber: number | null;
  toTableNumber: number | null;
  sourceOrderId: number | null;
  reason: string;
  createdAt: string;
};

export const MOVE_MESSAGES = {
  reason: 'Informe o motivo, de 3 a 200 caracteres.',
  transferClosed: 'Só comandas abertas podem mudar de mesa.',
  mergeClosed: 'Só comandas abertas podem ser juntadas.',
  sameTable: 'A comanda já está nessa mesa.',
  tableNotFound: 'Mesa não encontrada.',
  orderNotFound: 'Comanda não encontrada.',
  sameOrder: 'Escolha duas comandas diferentes.',
  occupied: (number: number) => `A mesa ${number} já tem uma comanda aberta. Junte as contas em vez de transferir.`,
};

export const cleanReason = (reason: string) => reason.trim().replace(/\s+/g, ' ');

// RN-01
export function validateReason(reason: string): string | null {
  const length = cleanReason(reason).length;
  return length < 3 || length > 200 ? MOVE_MESSAGES.reason : null;
}

// RF-01 e RN-03: mesas livres, menos a atual, em ordem de número.
export function freeTablesFor(tables: readonly Table[], currentTableId: number): Table[] {
  return tables
    .filter((table) => table.id !== currentTableId && !table.order)
    .sort((a, b) => a.number - b.number);
}

// RF-02 e RN-04: outras mesas com comanda aberta.
export function mergeCandidates(tables: readonly Table[], currentOrderId: number): Table[] {
  return tables
    .filter((table) => table.order && table.order.status === 'OPEN' && table.order.id !== currentOrderId)
    .sort((a, b) => a.number - b.number);
}

const two = (value: number) => String(value).padStart(2, '0');
export const tableLabel = (number: number | null) => (number === null ? 'mesa removida' : `mesa ${two(number)}`);

// RF-03: texto do evento do ponto de vista da comanda do histórico.
export function describeEvent(event: OrderEvent): string {
  if (event.type === 'TRANSFER') {
    return `Transferida da ${tableLabel(event.fromTableNumber)} para a ${tableLabel(event.toTableNumber)}`;
  }
  if (event.sourceOrderId !== null && event.sourceOrderId !== event.orderId) {
    return `Recebeu a comanda #${event.sourceOrderId} da ${tableLabel(event.fromTableNumber)}`;
  }
  return `Juntada à comanda da ${tableLabel(event.toTableNumber)}`;
}

export function eventTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${two(date.getDate())}/${two(date.getMonth() + 1)} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

export function sortEvents(events: readonly OrderEvent[]): OrderEvent[] {
  return [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
}
