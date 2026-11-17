import { describe, expect, it } from 'vitest';
import {
  assertItemEditable,
  assertPriorityChange,
  changedByName,
  delayBand,
  nextStatus,
  parsePriority,
  QueueEntry,
  sortQueue,
  statusLabel,
  summarizeQueue,
  ticketNote,
  timestampField,
  waitingMinutes,
} from '../src/kitchen/kitchen-rules';

// Regras puras da cozinha (SPEC/2026-11-16-cozinha-kds.md).
const at = (hhmmss: string) => new Date(`2026-11-16T${hhmmss}.000Z`);

describe('RF-03 e RN-06: situação do pedido de cozinha', () => {
  it('segue aguardando → em preparo → pronto → entregue', () => {
    expect(nextStatus('QUEUED', 'start')).toBe('PREPARING');
    expect(nextStatus('PREPARING', 'ready')).toBe('READY');
    expect(nextStatus('READY', 'deliver')).toBe('DELIVERED');
  });

  it('deixa marcar pronto direto, sem passar por em preparo', () => {
    expect(nextStatus('QUEUED', 'ready')).toBe('READY');
  });

  it.each([
    ['PREPARING', 'start', 'Este pedido está em preparo e não pode começar o preparo.'],
    ['READY', 'start', 'Este pedido está pronto e não pode começar o preparo.'],
    ['READY', 'ready', 'Este pedido está pronto e não pode ficar pronto.'],
    ['DELIVERED', 'ready', 'Este pedido está entregue e não pode ficar pronto.'],
    ['QUEUED', 'deliver', 'Este pedido está aguardando e não pode ser entregue.'],
    ['PREPARING', 'deliver', 'Este pedido está em preparo e não pode ser entregue.'],
    ['CANCELLED', 'start', 'Este pedido está cancelado e não pode começar o preparo.'],
    ['CANCELLED', 'deliver', 'Este pedido está cancelado e não pode ser entregue.'],
  ] as const)('recusa %s → %s', (from, action, message) => {
    expect(() => nextStatus(from, action)).toThrow(message);
  });

  it('cada ação grava a própria hora', () => {
    expect(timestampField('start')).toBe('startedAt');
    expect(timestampField('ready')).toBe('readyAt');
    expect(timestampField('deliver')).toBe('deliveredAt');
  });

  it('dá nome a todas as situações', () => {
    expect(['QUEUED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'].map((s) => statusLabel(s as never))).toEqual([
      'aguardando', 'em preparo', 'pronto', 'entregue', 'cancelado',
    ]);
  });
});

describe('RN-04: minutos de espera', () => {
  it('conta minutos inteiros desde o envio, arredondando para baixo', () => {
    expect(waitingMinutes(at('12:00:00'), null, at('12:00:59'))).toBe(0);
    expect(waitingMinutes(at('12:00:00'), null, at('12:01:00'))).toBe(1);
    expect(waitingMinutes(at('12:00:00'), null, at('12:09:59'))).toBe(9);
    expect(waitingMinutes(at('12:00:00'), null, at('13:30:00'))).toBe(90);
  });

  it('para de contar quando o pedido fica pronto', () => {
    expect(waitingMinutes(at('12:00:00'), at('12:12:30'), at('14:00:00'))).toBe(12);
  });

  it('nunca fica negativo se o relógio do envio estiver adiantado', () => {
    expect(waitingMinutes(at('12:05:00'), null, at('12:00:00'))).toBe(0);
  });
});

describe('RN-05: faixas de atraso (P-2)', () => {
  it.each([
    [0, 'NO_PRAZO'],
    [9, 'NO_PRAZO'],
    [10, 'ATENCAO'],
    [19, 'ATENCAO'],
    [20, 'ATRASADO'],
    [95, 'ATRASADO'],
  ] as const)('%i minutos é %s', (minutes, band) => {
    expect(delayBand(minutes)).toBe(band);
  });
});

describe('RN-07: prioridade', () => {
  it('aceita NORMAL e HIGH', () => {
    expect(parsePriority('NORMAL')).toBe('NORMAL');
    expect(parsePriority('HIGH')).toBe('HIGH');
  });

  it.each(['ALTA', 'high', '', undefined, 1])('recusa %s', (value) => {
    expect(() => parsePriority(value)).toThrow('Informe a prioridade: NORMAL ou HIGH.');
  });

  it('muda só na fila e só para outra prioridade', () => {
    expect(() => assertPriorityChange('QUEUED', 'NORMAL', 'HIGH')).not.toThrow();
    expect(() => assertPriorityChange('PREPARING', 'HIGH', 'NORMAL')).not.toThrow();
    expect(() => assertPriorityChange('READY', 'NORMAL', 'HIGH')).not.toThrow();
    expect(() => assertPriorityChange('QUEUED', 'HIGH', 'HIGH')).toThrow('O pedido já está com essa prioridade.');
    expect(() => assertPriorityChange('DELIVERED', 'NORMAL', 'HIGH')).toThrow('Só pedidos na fila podem mudar de prioridade.');
    expect(() => assertPriorityChange('CANCELLED', 'NORMAL', 'HIGH')).toThrow('Só pedidos na fila podem mudar de prioridade.');
  });

  it('exige quem mudou, de 2 a 80 caracteres', () => {
    expect(changedByName('  Ana  ')).toBe('Ana');
    expect(changedByName('Li')).toBe('Li');
    expect(changedByName('x'.repeat(80))).toHaveLength(80);
    for (const bad of [undefined, '', ' A ', 'x'.repeat(81)]) {
      expect(() => changedByName(bad)).toThrow('Informe quem mudou a prioridade, de 2 a 80 caracteres.');
    }
  });
});

describe('RF-01: observação do envio', () => {
  it('é opcional e vem sem espaços nas pontas', () => {
    expect(ticketNote(undefined)).toBeNull();
    expect(ticketNote(null)).toBeNull();
    expect(ticketNote('   ')).toBeNull();
    expect(ticketNote('  sem cebola ')).toBe('sem cebola');
    expect(ticketNote('x'.repeat(200))).toHaveLength(200);
  });

  it('recusa texto longo ou que não é texto', () => {
    expect(() => ticketNote('x'.repeat(201))).toThrow('A observação deve ter até 200 caracteres.');
    expect(() => ticketNote(42)).toThrow('A observação deve ter até 200 caracteres.');
  });
});

describe('RF-02: ordem da fila', () => {
  const ticket = (id: number, priority: 'NORMAL' | 'HIGH', sent: string): QueueEntry => ({
    id, priority, status: 'QUEUED', sentAt: at(sent),
  });

  it('põe alta prioridade primeiro e, dentro dela, quem chegou antes', () => {
    const queue = [
      ticket(1, 'NORMAL', '12:00:00'),
      ticket(2, 'NORMAL', '12:05:00'),
      ticket(3, 'HIGH', '12:10:00'),
      ticket(4, 'HIGH', '12:02:00'),
    ];
    expect(sortQueue(queue).map((t) => t.id)).toEqual([4, 3, 1, 2]);
  });

  it('desempata pelo número do pedido quando chegam no mesmo instante', () => {
    expect(sortQueue([ticket(9, 'NORMAL', '12:00:00'), ticket(7, 'NORMAL', '12:00:00')]).map((t) => t.id)).toEqual([7, 9]);
  });

  it('não altera a lista original', () => {
    const queue = [ticket(2, 'NORMAL', '12:05:00'), ticket(1, 'NORMAL', '12:00:00')];
    sortQueue(queue);
    expect(queue.map((t) => t.id)).toEqual([2, 1]);
  });
});

describe('RF-02: resumo da fila', () => {
  it('conta por situação, por faixa e por prioridade alta', () => {
    expect(
      summarizeQueue([
        { status: 'QUEUED', priority: 'HIGH', band: 'ATRASADO' },
        { status: 'QUEUED', priority: 'NORMAL', band: 'NO_PRAZO' },
        { status: 'PREPARING', priority: 'NORMAL', band: 'ATENCAO' },
        { status: 'READY', priority: 'HIGH', band: 'ATRASADO' },
      ]),
    ).toEqual({
      total: 4,
      byStatus: { QUEUED: 2, PREPARING: 1, READY: 1 },
      byBand: { NO_PRAZO: 1, ATENCAO: 1, ATRASADO: 1 },
      highPriority: 2,
    });
  });

  it('ignora entregues e cancelados', () => {
    expect(
      summarizeQueue([
        { status: 'DELIVERED', priority: 'HIGH', band: 'ATRASADO' },
        { status: 'CANCELLED', priority: 'NORMAL', band: 'NO_PRAZO' },
      ]).total,
    ).toBe(0);
  });
});

describe('RN-03: item enviado fica travado', () => {
  it('libera item não enviado e trava item enviado', () => {
    expect(() => assertItemEditable({ ticketId: null })).not.toThrow();
    expect(() => assertItemEditable({ ticketId: 0 })).toThrow('Este item já foi enviado para a cozinha e não pode ser alterado.');
    expect(() => assertItemEditable({ ticketId: 12 })).toThrow('Este item já foi enviado para a cozinha e não pode ser alterado.');
  });
});
