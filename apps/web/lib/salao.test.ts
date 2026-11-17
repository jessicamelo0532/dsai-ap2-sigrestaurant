import { describe, expect, it } from 'vitest';
import {
  buildFloor,
  filterCounts,
  filterFloor,
  formatElapsed,
  groupLines,
  minutesOpen,
  summarizeFloor,
} from './salao';
import type { Order, OrderItem, Table } from './types';

const now = new Date('2026-11-16T20:00:00.000Z');

function line(id: number, nameSnapshot: string, unitPrice: string, quantity: number): OrderItem {
  return { id, menuItemId: id, nameSnapshot, unitPrice, quantity };
}

function order(id: number, openedAt: string, items: OrderItem[]): Order {
  return { id, tableNumber: id, status: 'OPEN', openedAt, items };
}

function table(id: number, number: number, capacity: number, open: Order | null = null): Table {
  return { id, number, capacity, order: open };
}

// Salão de exemplo: 5 mesas, 3 ocupadas abertas em horários diferentes.
const salao: Table[] = [
  table(1, 1, 4),
  table(2, 2, 2, order(20, '2026-11-16T19:30:00.000Z', [line(1, 'Tacacá', '18.00', 1)])),
  table(3, 3, 6, order(30, '2026-11-16T18:45:00.000Z', [
    line(1, 'Maniçoba', '42.50', 2),
    line(2, 'Suco de cupuaçu', '9.90', 3),
    line(3, 'Maniçoba', '42.50', 1),
  ])),
  table(4, 4, 4),
  table(5, 5, 4, order(50, '2026-11-16T19:30:00.000Z', [line(1, 'Açaí', '15.00', 2)])),
];

describe('RN-02: tempo aberto', () => {
  it('conta minutos inteiros desde a abertura', () => {
    expect(minutesOpen('2026-11-16T19:18:30.000Z', now)).toBe(41);
    expect(minutesOpen('2026-11-16T18:45:00.000Z', now)).toBe(75);
  });

  it('nunca fica negativo, mesmo com relógio adiantado ou data inválida', () => {
    expect(minutesOpen('2026-11-16T20:05:00.000Z', now)).toBe(0);
    expect(minutesOpen('não é data', now)).toBe(0);
  });

  it.each([
    [0, 'agora'],
    [1, '1 min'],
    [59, '59 min'],
    [60, '1 h 00 min'],
    [75, '1 h 15 min'],
    [605, '10 h 05 min'],
  ])('mostra %s minutos como "%s"', (minutes, text) => {
    expect(formatElapsed(minutes)).toBe(text);
  });
});

describe('RF-04 e RN-03: itens do pedido', () => {
  it('junta o mesmo prato lançado em momentos diferentes e soma a quantidade', () => {
    const lines = groupLines(salao[2].order!);

    expect(lines).toEqual([
      { name: 'Maniçoba', unitPriceCents: 4250, quantity: 3, subtotalCents: 12750 },
      { name: 'Suco de cupuaçu', unitPriceCents: 990, quantity: 3, subtotalCents: 2970 },
    ]);
  });

  it('mesmo nome com preço diferente fica em linhas separadas', () => {
    const lines = groupLines(order(1, '2026-11-16T19:00:00.000Z', [
      line(1, 'Tacacá', '18.00', 1),
      line(2, 'Tacacá', '20.00', 1),
    ]));

    expect(lines.map((item) => item.unitPriceCents)).toEqual([1800, 2000]);
  });

  it('soma em centavos sem erro de arredondamento', () => {
    const lines = groupLines(order(1, '2026-11-16T19:00:00.000Z', [line(1, 'Água', '0.10', 3), line(2, 'Água', '0.10', 0)]));

    expect(lines[0].subtotalCents).toBe(30);
  });
});

describe('RF-02, RF-03 e RF-05: painel e resumo', () => {
  it('mesa ocupada traz pedido agrupado, tempo aberto, quantidade de itens e total', () => {
    const floor = buildFloor(salao, now);

    expect(floor[2]).toMatchObject({
      number: 3,
      capacity: 6,
      orderId: 30,
      openedAt: '2026-11-16T18:45:00.000Z',
      minutesOpen: 75,
      itemCount: 6,
      totalCents: 15720,
    });
    expect(floor[2].lines).toHaveLength(2);
  });

  it('mesa livre vem sem comanda, sem tempo e sem total', () => {
    expect(buildFloor(salao, now)[0]).toEqual({
      id: 1, number: 1, capacity: 4, orderId: null, openedAt: null, minutesOpen: null, lines: [], itemCount: 0, totalCents: 0,
    });
  });

  it('resume ocupadas, livres, total em aberto e a conta mais antiga', () => {
    expect(summarizeFloor(buildFloor(salao, now))).toEqual({
      tables: 5,
      occupied: 3,
      free: 2,
      openTotalCents: 1800 + 15720 + 3000,
      oldest: { number: 3, minutesOpen: 75 },
    });
  });

  it('salão vazio ou sem contas abertas não tem conta mais antiga', () => {
    expect(summarizeFloor([])).toEqual({ tables: 0, occupied: 0, free: 0, openTotalCents: 0, oldest: null });
    expect(summarizeFloor(buildFloor([table(1, 1, 4)], now)).oldest).toBeNull();
  });
});

describe('RF-06 e RF-07: filtros e ordem', () => {
  const floor = buildFloor(salao, now);

  it('todas: ocupadas da conta mais antiga para a mais nova, empate pelo número, depois as livres', () => {
    expect(filterFloor(floor, 'todas').map((item) => item.number)).toEqual([3, 2, 5, 1, 4]);
  });

  it('ocupadas e livres mostram só o próprio grupo', () => {
    expect(filterFloor(floor, 'ocupadas').map((item) => item.number)).toEqual([3, 2, 5]);
    expect(filterFloor(floor, 'livres').map((item) => item.number)).toEqual([1, 4]);
  });

  it('mesa aberta agora (0 minutos) ainda vem antes das livres', () => {
    const justOpened = buildFloor([table(1, 1, 4), table(9, 9, 2, order(90, '2026-11-16T20:00:00.000Z', [line(1, 'Água', '5.00', 1)]))], now);

    expect(filterFloor(justOpened, 'todas').map((item) => item.number)).toEqual([9, 1]);
  });

  it('empate no tempo aberto é decidido pelo número, mesmo com as mesas fora de ordem', () => {
    const sameTime = '2026-11-16T19:00:00.000Z';
    const shuffled = buildFloor([
      table(7, 7, 4, order(70, sameTime, [line(1, 'Açaí', '15.00', 1)])),
      table(2, 2, 4, order(20, sameTime, [line(1, 'Açaí', '15.00', 1)])),
    ], now);

    expect(filterFloor(shuffled, 'ocupadas').map((item) => item.number)).toEqual([2, 7]);
  });

  it('não altera a lista original', () => {
    filterFloor(floor, 'todas');

    expect(floor.map((item) => item.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it('conta quantas mesas há em cada filtro', () => {
    expect(filterCounts(floor)).toEqual({ todas: 5, ocupadas: 3, livres: 2 });
  });
});
