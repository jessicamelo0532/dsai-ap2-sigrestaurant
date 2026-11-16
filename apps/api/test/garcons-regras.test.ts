import { describe, expect, it } from 'vitest';
import { basisPointsToDecimal, commissionCents, NO_WAITER, rateBasisPoints, waiterReport } from '../src/waiters/waiter-rules';

describe('RN-02: taxa de comissão', () => {
  it('aceita de 0 a 30%, com até 2 casas', () => {
    expect(rateBasisPoints(10)).toBe(1000);
    expect(rateBasisPoints('12.5')).toBe(1250);
    expect(rateBasisPoints(0)).toBe(0);
    expect(rateBasisPoints(30)).toBe(3000);
    expect(rateBasisPoints({ toString: () => '7.25' })).toBe(725);
  });

  it.each([-1, 30.01, 10.555, 'dez', Number.NaN])('recusa %s', (value) => {
    expect(() => rateBasisPoints(value)).toThrow('Informe a comissão de 0 a 30%, com até 2 casas decimais.');
  });

  it('volta para texto com 2 casas', () => {
    expect(basisPointsToDecimal(1000)).toBe('10.00');
    expect(basisPointsToDecimal(1250)).toBe('12.50');
    expect(basisPointsToDecimal(5)).toBe('0.05');
  });
});

describe('RN-05: comissão da comanda', () => {
  it('receita × taxa, arredondada ao centavo', () => {
    expect(commissionCents(10000, 1000)).toBe(1000);
    expect(commissionCents(4550, 1000)).toBe(455);
    expect(commissionCents(3333, 1250)).toBe(417);
    expect(commissionCents(1000, 0)).toBe(0);
  });
});

describe('RN-05 a RN-07: relatório por garçom', () => {
  const report = waiterReport([
    { waiterId: 1, waiterName: 'Ana', revenueCents: 10000, basisPoints: 1000 },
    { waiterId: 2, waiterName: 'Bruno', revenueCents: 30000, basisPoints: 1000 },
    { waiterId: 1, waiterName: 'Ana', revenueCents: 5000, basisPoints: 1200 },
    { waiterId: null, waiterName: null, revenueCents: 99900, basisPoints: 1000 },
    { waiterId: null, waiterName: 'Carla (desligada)', revenueCents: 2000, basisPoints: 1000 },
  ]);

  it('agrupa por garçom, maior receita primeiro, "Sem garçom" por último', () => {
    expect(report.waiters.map((row) => row.name)).toEqual(['Bruno', 'Ana', 'Carla (desligada)', NO_WAITER]);
  });

  it('soma contas, receita, ticket médio e comissão com a taxa de cada comanda', () => {
    expect(report.waiters[1]).toEqual({
      waiterId: 1, name: 'Ana', paidOrders: 2, revenueCents: 15000, commissionCents: 1000 + 600, averageTicketCents: 7500,
    });
  });

  it('"Sem garçom" não gera comissão', () => {
    expect(report.waiters[3]).toMatchObject({ paidOrders: 1, revenueCents: 99900, commissionCents: 0 });
  });

  it('garçom removido do cadastro aparece pelo nome guardado na comanda', () => {
    expect(report.waiters[2]).toMatchObject({ waiterId: null, name: 'Carla (desligada)', commissionCents: 200 });
  });

  it('a soma por garçom é a receita do período', () => {
    expect(report.totals).toEqual({ paidOrders: 5, revenueCents: 146900, commissionCents: 1000 + 3000 + 600 + 200 });
  });

  it('empate de receita decide pelo nome', () => {
    const tie = waiterReport([
      { waiterId: 2, waiterName: 'Bia', revenueCents: 100, basisPoints: 0 },
      { waiterId: 1, waiterName: 'Ana', revenueCents: 100, basisPoints: 0 },
    ]);
    expect(tie.waiters.map((row) => row.name)).toEqual(['Ana', 'Bia']);
  });

  it('sem vendas, sem linhas', () => {
    expect(waiterReport([])).toEqual({ waiters: [], totals: { paidOrders: 0, revenueCents: 0, commissionCents: 0 } });
  });
});
