// Regras puras da cozinha (SPEC/2026-11-16-cozinha-kds.md).
import { BadRequestException } from '@nestjs/common';
import { text } from '../cash/cash-rules';

export const STATUSES = ['QUEUED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'] as const;
export type TicketStatus = (typeof STATUSES)[number];
export const PRIORITIES = ['NORMAL', 'HIGH'] as const;
export type Priority = (typeof PRIORITIES)[number];
export type Action = 'start' | 'ready' | 'deliver';
export type DelayBand = 'NO_PRAZO' | 'ATENCAO' | 'ATRASADO';

// Situações que aparecem na fila de produção (RF-02).
export const QUEUE_STATUSES: readonly TicketStatus[] = ['QUEUED', 'PREPARING', 'READY'];

// P-2 (provisório): limites das faixas de atraso, em minutos.
export const ATTENTION_FROM = 10;
export const LATE_FROM = 20;

const STATUS_LABEL: Record<TicketStatus, string> = {
  QUEUED: 'aguardando',
  PREPARING: 'em preparo',
  READY: 'pronto',
  DELIVERED: 'entregue',
  CANCELLED: 'cancelado',
};

const ACTION_LABEL: Record<Action, string> = {
  start: 'começar o preparo',
  ready: 'ficar pronto',
  deliver: 'ser entregue',
};

// RF-03: de onde cada ação pode partir e para onde leva.
const TRANSITIONS: Record<Action, { from: readonly TicketStatus[]; to: TicketStatus }> = {
  start: { from: ['QUEUED'], to: 'PREPARING' },
  ready: { from: ['QUEUED', 'PREPARING'], to: 'READY' },
  deliver: { from: ['READY'], to: 'DELIVERED' },
};

export function statusLabel(status: TicketStatus) {
  return STATUS_LABEL[status];
}

// RN-06
export function nextStatus(current: TicketStatus, action: Action): TicketStatus {
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(current)) {
    throw new BadRequestException(`Este pedido está ${STATUS_LABEL[current]} e não pode ${ACTION_LABEL[action]}.`);
  }
  return rule.to;
}

// Campo de hora que cada ação preenche.
export function timestampField(action: Action) {
  return ({ start: 'startedAt', ready: 'readyAt', deliver: 'deliveredAt' } as const)[action];
}

// RN-04: minutos inteiros do envio até ficar pronto (ou até agora).
export function waitingMinutes(sentAt: Date, readyAt: Date | null, now: Date) {
  const end = readyAt ?? now;
  return Math.max(0, Math.floor((end.getTime() - sentAt.getTime()) / 60_000));
}

// RN-05
export function delayBand(minutes: number): DelayBand {
  if (minutes >= LATE_FROM) return 'ATRASADO';
  if (minutes >= ATTENTION_FROM) return 'ATENCAO';
  return 'NO_PRAZO';
}

// RN-07
export function parsePriority(value: unknown): Priority {
  if (typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value)) return value as Priority;
  throw new BadRequestException('Informe a prioridade: NORMAL ou HIGH.');
}

export function assertPriorityChange(status: TicketStatus, current: Priority, next: Priority) {
  if (!QUEUE_STATUSES.includes(status)) throw new BadRequestException('Só pedidos na fila podem mudar de prioridade.');
  if (current === next) throw new BadRequestException('O pedido já está com essa prioridade.');
}

export function changedByName(value: string | undefined) {
  return text(value, 2, 80, 'Informe quem mudou a prioridade, de 2 a 80 caracteres.');
}

// RF-01: observação opcional de até 200 caracteres.
export function ticketNote(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new BadRequestException('A observação deve ter até 200 caracteres.');
  const note = value.trim();
  if (note.length > 200) throw new BadRequestException('A observação deve ter até 200 caracteres.');
  return note || null;
}

export interface QueueEntry {
  id: number;
  priority: Priority;
  status: TicketStatus;
  sentAt: Date;
}

// RF-02: alta primeiro; dentro da prioridade, quem chegou antes; empate pelo número do pedido.
export function sortQueue<T extends QueueEntry>(tickets: readonly T[]): T[] {
  const weight = (p: Priority) => (p === 'HIGH' ? 0 : 1);
  return [...tickets].sort(
    (a, b) => weight(a.priority) - weight(b.priority) || a.sentAt.getTime() - b.sentAt.getTime() || a.id - b.id,
  );
}

export interface QueueSummary {
  total: number;
  byStatus: Record<'QUEUED' | 'PREPARING' | 'READY', number>;
  byBand: Record<DelayBand, number>;
  highPriority: number;
}

// RF-02: resumo da fila. Pronto não conta como atrasado: o preparo já terminou.
export function summarizeQueue(entries: readonly { status: TicketStatus; priority: Priority; band: DelayBand }[]): QueueSummary {
  const summary: QueueSummary = {
    total: 0,
    byStatus: { QUEUED: 0, PREPARING: 0, READY: 0 },
    byBand: { NO_PRAZO: 0, ATENCAO: 0, ATRASADO: 0 },
    highPriority: 0,
  };
  for (const entry of entries) {
    if (!QUEUE_STATUSES.includes(entry.status)) continue;
    summary.total += 1;
    summary.byStatus[entry.status as 'QUEUED' | 'PREPARING' | 'READY'] += 1;
    if (entry.status !== 'READY') summary.byBand[entry.band] += 1;
    if (entry.priority === 'HIGH') summary.highPriority += 1;
  }
  return summary;
}

// RN-03
export const SENT_ITEM_MESSAGE = 'Este item já foi enviado para a cozinha e não pode ser alterado.';
export function assertItemEditable(item: { ticketId: number | null }) {
  if (item.ticketId !== null) throw new BadRequestException(SENT_ITEM_MESSAGE);
}
