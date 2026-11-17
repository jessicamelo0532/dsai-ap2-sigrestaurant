import { describe, expect, it } from 'vitest';
import {
  actionLabels,
  allowedActions,
  ATTENTION_FROM_MINUTES,
  bandFor,
  bandHint,
  bandLabels,
  bandOf,
  canChangePriority,
  channelLabels,
  filterCounts,
  filterQueue,
  formatWait,
  INVALID_CHANGED_BY,
  INVALID_NOTE,
  itemCountLabel,
  itemsText,
  KITCHEN_REFRESH_MS,
  kitchenFilters,
  LATE_FROM_MINUTES,
  nextPriority,
  placeLabel,
  priorityLabels,
  queueCards,
  sortQueue,
  statusLabels,
  summarize,
  ticketCountLabel,
  ticketTitle,
  validateChangedBy,
  validateNote,
  waiterLabel,
  type KitchenTicket,
} from './cozinha';

function ticket(overrides: Partial<KitchenTicket> = {}): KitchenTicket {
  return {
    id: 1,
    orderId: 10,
    tableNumber: 3,
    channel: 'DINE_IN',
    waiterName: 'Ana',
    status: 'QUEUED',
    priority: 'NORMAL',
    note: null,
    sentAt: '2026-11-17T12:00:00.000Z',
    startedAt: null,
    readyAt: null,
    deliveredAt: null,
    cancelledAt: null,
    waitingMinutes: 4,
    band: 'NO_PRAZO',
    items: [{ id: 1, name: 'Açaí', quantity: 2, addons: [] }],
    ...overrides,
  };
}

describe('faixas de atraso (RN-01 e RN-05)', () => {
  it('usa os limites 10 e 20 minutos', () => {
    expect(ATTENTION_FROM_MINUTES).toBe(10);
    expect(LATE_FROM_MINUTES).toBe(20);
    expect(bandFor(0)).toBe('NO_PRAZO');
    expect(bandFor(9)).toBe('NO_PRAZO');
    expect(bandFor(10)).toBe('ATENCAO');
    expect(bandFor(19)).toBe('ATENCAO');
    expect(bandFor(20)).toBe('ATRASADO');
    expect(bandFor(120)).toBe('ATRASADO');
  });

  it('trata tempo inválido como no prazo', () => {
    expect(bandFor(-1)).toBe('NO_PRAZO');
    expect(bandFor(Number.NaN)).toBe('NO_PRAZO');
  });

  it('prefere a faixa que veio da API', () => {
    expect(bandOf({ band: 'ATRASADO', waitingMinutes: 1 })).toBe('ATRASADO');
    expect(bandOf({ band: undefined as never, waitingMinutes: 12 })).toBe('ATENCAO');
  });

  it('tem rótulo e explicação para cada faixa', () => {
    expect(bandLabels.NO_PRAZO).toBe('No prazo');
    expect(bandLabels.ATENCAO).toBe('Atenção');
    expect(bandLabels.ATRASADO).toBe('Atrasado');
    expect(bandHint.NO_PRAZO).toContain('9 min');
    expect(bandHint.ATRASADO).toContain('20 min');
  });
});

describe('formatação (RF-01)', () => {
  it('mostra o tempo de espera em minutos e horas', () => {
    expect(formatWait(0)).toBe('agora');
    expect(formatWait(-2)).toBe('agora');
    expect(formatWait(1)).toBe('1 min');
    expect(formatWait(45)).toBe('45 min');
    expect(formatWait(60)).toBe('1 h');
    expect(formatWait(65)).toBe('1 h 5 min');
    expect(formatWait(125)).toBe('2 h 5 min');
  });

  it('chama a mesa de Mesa 03 e o pedido sem mesa de Delivery', () => {
    expect(placeLabel({ tableNumber: 3, channel: 'DINE_IN' })).toBe('Mesa 03');
    expect(placeLabel({ tableNumber: 12, channel: 'DINE_IN' })).toBe('Mesa 12');
    expect(placeLabel({ tableNumber: 0, channel: 'DELIVERY' })).toBe('Delivery');
    expect(placeLabel({ tableNumber: 0, channel: 'DINE_IN' })).toBe('Delivery');
    expect(channelLabels.DELIVERY).toBe('Delivery');
    expect(channelLabels.DINE_IN).toBe('Salão');
  });

  it('trata garçom ausente e título do pedido', () => {
    expect(waiterLabel(null)).toBe('Sem garçom');
    expect(waiterLabel('   ')).toBe('Sem garçom');
    expect(waiterLabel('Ana')).toBe('Ana');
    expect(ticketTitle({ id: 7 })).toBe('Pedido 007');
  });

  it('conta pedidos e itens', () => {
    expect(ticketCountLabel(0)).toBe('0 pedidos');
    expect(ticketCountLabel(1)).toBe('1 pedido');
    expect(ticketCountLabel(3)).toBe('3 pedidos');
    expect(itemCountLabel(0)).toBe('0 itens');
    expect(itemCountLabel(1)).toBe('1 item');
    expect(itemCountLabel(4)).toBe('4 itens');
    expect(itemsText([{ id: 1, name: 'Açaí', quantity: 2, addons: [] }])).toBe('2 × Açaí');
    expect(itemsText([
      { id: 1, name: 'Açaí', quantity: 1, addons: ['Granola'] },
      { id: 2, name: 'Suco', quantity: 3, addons: [] },
    ])).toBe('1 × Açaí · 3 × Suco');
  });
});

describe('ações por situação (RF-02)', () => {
  it('permite só o que a API aceita', () => {
    expect(allowedActions('QUEUED')).toEqual(['start', 'ready']);
    expect(allowedActions('PREPARING')).toEqual(['ready']);
    expect(allowedActions('READY')).toEqual(['deliver']);
    expect(allowedActions('DELIVERED')).toEqual([]);
    expect(allowedActions('CANCELLED')).toEqual([]);
  });

  it('só pedidos na fila mudam de prioridade', () => {
    expect(canChangePriority('QUEUED')).toBe(true);
    expect(canChangePriority('PREPARING')).toBe(true);
    expect(canChangePriority('READY')).toBe(true);
    expect(canChangePriority('DELIVERED')).toBe(false);
    expect(canChangePriority('CANCELLED')).toBe(false);
  });

  it('alterna entre normal e alta', () => {
    expect(nextPriority('NORMAL')).toBe('HIGH');
    expect(nextPriority('HIGH')).toBe('NORMAL');
    expect(priorityLabels.HIGH).toBe('Alta');
    expect(priorityLabels.NORMAL).toBe('Normal');
  });

  it('tem rótulo para cada situação e ação', () => {
    expect(statusLabels.QUEUED).toBe('Aguardando');
    expect(statusLabels.PREPARING).toBe('Em preparo');
    expect(statusLabels.READY).toBe('Pronto');
    expect(actionLabels.start).toBe('Iniciar preparo');
    expect(actionLabels.ready).toBe('Pronto');
    expect(actionLabels.deliver).toBe('Entregue');
  });
});

describe('validações antes do envio (RN-03 e RN-04)', () => {
  it('exige quem mudou com 2 a 80 caracteres', () => {
    expect(validateChangedBy('')).toBe(INVALID_CHANGED_BY);
    expect(validateChangedBy('  a  ')).toBe(INVALID_CHANGED_BY);
    expect(validateChangedBy('Ana')).toBeNull();
    expect(validateChangedBy('a'.repeat(80))).toBeNull();
    expect(validateChangedBy('a'.repeat(81))).toBe(INVALID_CHANGED_BY);
  });

  it('limita a observação a 200 caracteres', () => {
    expect(validateNote('')).toBeNull();
    expect(validateNote('sem cebola')).toBeNull();
    expect(validateNote('a'.repeat(200))).toBeNull();
    expect(validateNote('a'.repeat(201))).toBe(INVALID_NOTE);
  });
});

describe('ordenação defensiva (RN-06)', () => {
  it('põe prioridade alta primeiro e depois por chegada', () => {
    const ordered = sortQueue([
      ticket({ id: 1, sentAt: '2026-11-17T12:00:00.000Z' }),
      ticket({ id: 2, sentAt: '2026-11-17T12:05:00.000Z', priority: 'HIGH' }),
      ticket({ id: 3, sentAt: '2026-11-17T11:55:00.000Z' }),
    ]);
    expect(ordered.map((entry) => entry.id)).toEqual([2, 3, 1]);
  });

  it('desempata pelo id quando a hora é igual', () => {
    const ordered = sortQueue([
      ticket({ id: 9, sentAt: '2026-11-17T12:00:00.000Z' }),
      ticket({ id: 4, sentAt: '2026-11-17T12:00:00.000Z' }),
    ]);
    expect(ordered.map((entry) => entry.id)).toEqual([4, 9]);
  });

  it('não muda o array recebido', () => {
    const original = [ticket({ id: 2, priority: 'NORMAL' }), ticket({ id: 1, priority: 'HIGH' })];
    const ordered = sortQueue(original);
    expect(original.map((entry) => entry.id)).toEqual([2, 1]);
    expect(ordered.map((entry) => entry.id)).toEqual([1, 2]);
  });
});

describe('resumo (RN-05)', () => {
  it('conta por situação e por faixa, sem atrasar o que está pronto', () => {
    const summary = summarize([
      ticket({ id: 1, status: 'QUEUED', band: 'NO_PRAZO', waitingMinutes: 3 }),
      ticket({ id: 2, status: 'QUEUED', band: 'ATRASADO', waitingMinutes: 25 }),
      ticket({ id: 3, status: 'PREPARING', band: 'ATENCAO', waitingMinutes: 12, priority: 'HIGH' }),
      ticket({ id: 4, status: 'READY', band: 'ATRASADO', waitingMinutes: 40 }),
      ticket({ id: 5, status: 'DELIVERED', band: 'ATRASADO', waitingMinutes: 90 }),
      ticket({ id: 6, status: 'CANCELLED', band: 'ATRASADO', waitingMinutes: 90 }),
    ]);
    expect(summary.total).toBe(4);
    expect(summary.byStatus).toEqual({ QUEUED: 2, PREPARING: 1, READY: 1 });
    expect(summary.byBand).toEqual({ NO_PRAZO: 1, ATENCAO: 1, ATRASADO: 1 });
    expect(summary.highPriority).toBe(1);
  });

  it('usa a faixa calculada quando o pedido não traz a da API', () => {
    const summary = summarize([ticket({ band: undefined as never, waitingMinutes: 21 })]);
    expect(summary.byBand.ATRASADO).toBe(1);
  });

  it('devolve resumo zerado sem pedidos', () => {
    expect(summarize([])).toEqual({
      total: 0,
      byStatus: { QUEUED: 0, PREPARING: 0, READY: 0 },
      byBand: { NO_PRAZO: 0, ATENCAO: 0, ATRASADO: 0 },
      highPriority: 0,
    });
  });
});

describe('filtros (RF-07)', () => {
  const queue = [
    ticket({ id: 1, status: 'QUEUED', band: 'NO_PRAZO' }),
    ticket({ id: 2, status: 'PREPARING', band: 'ATENCAO', priority: 'HIGH' }),
    ticket({ id: 3, status: 'READY', band: 'ATRASADO' }),
    ticket({ id: 4, status: 'QUEUED', band: 'ATRASADO' }),
    ticket({ id: 5, status: 'DELIVERED', band: 'ATRASADO' }),
  ];

  it('tem seis filtros, começando por Todas', () => {
    expect(kitchenFilters.map((option) => option.id)).toEqual([
      'todas', 'aguardando', 'preparo', 'prontos', 'atrasados', 'prioridade',
    ]);
  });

  it('nunca mostra pedido fora da fila', () => {
    expect(filterQueue(queue, 'todas').map((entry) => entry.id)).toEqual([1, 2, 3, 4]);
  });

  it('filtra por situação, atraso e prioridade', () => {
    expect(filterQueue(queue, 'aguardando').map((entry) => entry.id)).toEqual([1, 4]);
    expect(filterQueue(queue, 'preparo').map((entry) => entry.id)).toEqual([2]);
    expect(filterQueue(queue, 'prontos').map((entry) => entry.id)).toEqual([3]);
    expect(filterQueue(queue, 'atrasados').map((entry) => entry.id)).toEqual([4]);
    expect(filterQueue(queue, 'prioridade').map((entry) => entry.id)).toEqual([2]);
  });

  it('conta cada filtro', () => {
    expect(filterCounts(queue)).toEqual({
      todas: 4, aguardando: 2, preparo: 1, prontos: 1, atrasados: 1, prioridade: 1,
    });
  });
});

describe('cartões da fila (RF-01)', () => {
  it('ordena e tira o que já saiu da fila', () => {
    const cards = queueCards([
      ticket({ id: 1, status: 'DELIVERED' }),
      ticket({ id: 2, sentAt: '2026-11-17T12:00:00.000Z' }),
      ticket({ id: 3, sentAt: '2026-11-17T12:10:00.000Z', priority: 'HIGH' }),
    ]);
    expect(cards.map((entry) => entry.id)).toEqual([3, 2]);
  });

  it('atualiza a cada 15 segundos (P-1)', () => {
    expect(KITCHEN_REFRESH_MS).toBe(15_000);
  });
});
