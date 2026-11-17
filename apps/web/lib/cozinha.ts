// Tela da cozinha (SPEC/2026-11-17-tela-da-cozinha.md).
// Funções puras: recebem a fila como GET /kitchen/queue devolve e preparam o painel.

export type KitchenStatus = 'QUEUED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
export type KitchenPriority = 'NORMAL' | 'HIGH';
export type DelayBand = 'NO_PRAZO' | 'ATENCAO' | 'ATRASADO';
export type KitchenChannel = 'DINE_IN' | 'DELIVERY';
export type KitchenAction = 'start' | 'ready' | 'deliver';

export type KitchenItem = { id: number; name: string; quantity: number; addons: string[] };

export type KitchenTicket = {
  id: number;
  orderId: number;
  tableNumber: number;
  channel: KitchenChannel;
  waiterName: string | null;
  status: KitchenStatus;
  priority: KitchenPriority;
  note: string | null;
  sentAt: string;
  startedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  waitingMinutes: number;
  band: DelayBand;
  items: KitchenItem[];
};

export type KitchenSummary = {
  total: number;
  byStatus: Record<'QUEUED' | 'PREPARING' | 'READY', number>;
  byBand: Record<DelayBand, number>;
  highPriority: number;
};

export type KitchenQueue = { generatedAt: string; summary: KitchenSummary; tickets: KitchenTicket[] };

// P-1 da SPEC: intervalo provisório de atualização automática do painel.
export const KITCHEN_REFRESH_MS = 15_000;

// RN-05 da SPEC da API: mesmos limites usados na tela.
export const ATTENTION_FROM_MINUTES = 10;
export const LATE_FROM_MINUTES = 20;

export const NOTE_MAX_LENGTH = 200;
export const CHANGED_BY_MIN_LENGTH = 2;
export const CHANGED_BY_MAX_LENGTH = 80;

export const INVALID_CHANGED_BY = 'Informe quem mudou a prioridade, de 2 a 80 caracteres.';
export const INVALID_NOTE = 'A observação pode ter até 200 caracteres.';

// RN-01: faixa calculada localmente só para cartões sem faixa da API.
export function bandFor(minutes: number): DelayBand {
  if (!Number.isFinite(minutes) || minutes < 0) return 'NO_PRAZO';
  if (minutes >= LATE_FROM_MINUTES) return 'ATRASADO';
  if (minutes >= ATTENTION_FROM_MINUTES) return 'ATENCAO';
  return 'NO_PRAZO';
}

export const bandLabels: Record<DelayBand, string> = {
  NO_PRAZO: 'No prazo',
  ATENCAO: 'Atenção',
  ATRASADO: 'Atrasado',
};

export const bandHint: Record<DelayBand, string> = {
  NO_PRAZO: `Até ${ATTENTION_FROM_MINUTES - 1} min de espera`,
  ATENCAO: `De ${ATTENTION_FROM_MINUTES} a ${LATE_FROM_MINUTES - 1} min de espera`,
  ATRASADO: `${LATE_FROM_MINUTES} min ou mais de espera`,
};

export const statusLabels: Record<KitchenStatus, string> = {
  QUEUED: 'Aguardando',
  PREPARING: 'Em preparo',
  READY: 'Pronto',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

export const priorityLabels: Record<KitchenPriority, string> = {
  NORMAL: 'Normal',
  HIGH: 'Alta',
};

export const channelLabels: Record<KitchenChannel, string> = {
  DINE_IN: 'Salão',
  DELIVERY: 'Delivery',
};

export const actionLabels: Record<KitchenAction, string> = {
  start: 'Iniciar preparo',
  ready: 'Pronto',
  deliver: 'Entregue',
};

// RN-02: o tempo vem da API; a tela só formata (0 minuto é "agora").
export function formatWait(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'agora';
  if (minutes < 60) return `${Math.floor(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.floor(minutes % 60);
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

// RF-01: mesa 0 é pedido de delivery (SPEC da API, delivery).
export function placeLabel(ticket: Pick<KitchenTicket, 'tableNumber' | 'channel'>): string {
  if (ticket.channel === 'DELIVERY' || ticket.tableNumber === 0) return 'Delivery';
  return `Mesa ${String(ticket.tableNumber).padStart(2, '0')}`;
}

export function waiterLabel(waiterName: string | null): string {
  return waiterName?.trim() ? waiterName : 'Sem garçom';
}

export function ticketTitle(ticket: Pick<KitchenTicket, 'id'>): string {
  return `Pedido ${String(ticket.id).padStart(3, '0')}`;
}

export function itemCountLabel(count: number): string {
  return count === 1 ? '1 item' : `${count} itens`;
}

export function ticketCountLabel(count: number): string {
  return count === 1 ? '1 pedido' : `${count} pedidos`;
}

export function itemsText(items: readonly KitchenItem[]): string {
  return items.map((item) => `${item.quantity} × ${item.name}`).join(' · ');
}

// RF-02: só as ações permitidas pela situação (RF-03 da SPEC da API).
export function allowedActions(status: KitchenStatus): KitchenAction[] {
  if (status === 'QUEUED') return ['start', 'ready'];
  if (status === 'PREPARING') return ['ready'];
  if (status === 'READY') return ['deliver'];
  return [];
}

// RF-04: só pedidos na fila mudam de prioridade (RN-07 da SPEC da API).
export function canChangePriority(status: KitchenStatus): boolean {
  return status === 'QUEUED' || status === 'PREPARING' || status === 'READY';
}

export function nextPriority(current: KitchenPriority): KitchenPriority {
  return current === 'HIGH' ? 'NORMAL' : 'HIGH';
}

// RN-03: valida antes de enviar, com a mesma mensagem da API.
export function validateChangedBy(value: string): string | null {
  const length = value.trim().length;
  if (length < CHANGED_BY_MIN_LENGTH || length > CHANGED_BY_MAX_LENGTH) return INVALID_CHANGED_BY;
  return null;
}

// RN-04: observação opcional de até 200 caracteres.
export function validateNote(value: string): string | null {
  return value.trim().length > NOTE_MAX_LENGTH ? INVALID_NOTE : null;
}

// RN-06: reordena de forma defensiva com a regra da API (alta primeiro, depois chegada).
export function sortQueue<T extends Pick<KitchenTicket, 'id' | 'priority' | 'sentAt'>>(tickets: readonly T[]): T[] {
  const weight = (priority: KitchenPriority) => (priority === 'HIGH' ? 0 : 1);
  return [...tickets].sort(
    (a, b) => weight(a.priority) - weight(b.priority)
      || new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
      || a.id - b.id,
  );
}

// RN-05: resumo igual ao da API; pronto não conta como atrasado.
export function summarize(tickets: readonly KitchenTicket[]): KitchenSummary {
  const summary: KitchenSummary = {
    total: 0,
    byStatus: { QUEUED: 0, PREPARING: 0, READY: 0 },
    byBand: { NO_PRAZO: 0, ATENCAO: 0, ATRASADO: 0 },
    highPriority: 0,
  };
  for (const ticket of tickets) {
    if (!canChangePriority(ticket.status)) continue;
    summary.total += 1;
    summary.byStatus[ticket.status as 'QUEUED' | 'PREPARING' | 'READY'] += 1;
    if (ticket.status !== 'READY') summary.byBand[ticket.band ?? bandFor(ticket.waitingMinutes)] += 1;
    if (ticket.priority === 'HIGH') summary.highPriority += 1;
  }
  return summary;
}

export type KitchenFilter = 'todas' | 'aguardando' | 'preparo' | 'prontos' | 'atrasados' | 'prioridade';

export const kitchenFilters: { id: KitchenFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'aguardando', label: 'Aguardando' },
  { id: 'preparo', label: 'Em preparo' },
  { id: 'prontos', label: 'Prontos' },
  { id: 'atrasados', label: 'Atrasados' },
  { id: 'prioridade', label: 'Alta prioridade' },
];

// RF-07: filtro de exibição, sem esconder pedidos da fila por engano.
export function filterQueue(tickets: readonly KitchenTicket[], filter: KitchenFilter): KitchenTicket[] {
  const inQueue = tickets.filter((ticket) => canChangePriority(ticket.status));
  if (filter === 'todas') return inQueue;
  if (filter === 'aguardando') return inQueue.filter((ticket) => ticket.status === 'QUEUED');
  if (filter === 'preparo') return inQueue.filter((ticket) => ticket.status === 'PREPARING');
  if (filter === 'prontos') return inQueue.filter((ticket) => ticket.status === 'READY');
  if (filter === 'prioridade') return inQueue.filter((ticket) => ticket.priority === 'HIGH');
  return inQueue.filter((ticket) => ticket.status !== 'READY' && (ticket.band ?? bandFor(ticket.waitingMinutes)) === 'ATRASADO');
}

export function filterCounts(tickets: readonly KitchenTicket[]): Record<KitchenFilter, number> {
  return {
    todas: filterQueue(tickets, 'todas').length,
    aguardando: filterQueue(tickets, 'aguardando').length,
    preparo: filterQueue(tickets, 'preparo').length,
    prontos: filterQueue(tickets, 'prontos').length,
    atrasados: filterQueue(tickets, 'atrasados').length,
    prioridade: filterQueue(tickets, 'prioridade').length,
  };
}

// RF-01: o cartão usa a faixa da API quando vier; senão, calcula pelo tempo.
export function bandOf(ticket: Pick<KitchenTicket, 'band' | 'waitingMinutes'>): DelayBand {
  return ticket.band ?? bandFor(ticket.waitingMinutes);
}

export function queueCards(tickets: readonly KitchenTicket[]): KitchenTicket[] {
  return sortQueue(tickets.filter((ticket) => canChangePriority(ticket.status)));
}
