import { describe, expect, it } from 'vitest';
import {
  assertMonthEnded,
  assertReopenReason,
  averageTicketCents,
  buildDre,
  closedMonthMessage,
  divergences,
  monthOf,
  parseMonth,
  previousMonth,
  variation,
} from '../src/closings/closing-rules';

describe('RN-01: mês', () => {
  it('transforma AAAA-MM no intervalo do mês em UTC', () => {
    const range = parseMonth('2026-10');

    expect(range.label).toBe('10/2026');
    expect(range.start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('dezembro termina no primeiro dia do ano seguinte', () => {
    expect(parseMonth('2026-12').end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it.each([undefined, '2026-13', '2026-00', '2026-1', '10/2026', '2026-10-01', 'outubro'])('recusa "%s"', (value) => {
    expect(() => parseMonth(value)).toThrow('Informe o mês no formato AAAA-MM.');
  });

  it('descobre o mês de uma data e o mês anterior', () => {
    expect(monthOf(new Date('2026-10-31T23:59:59.000Z'))).toBe('2026-10');
    expect(monthOf(new Date('2026-11-01T00:00:00.000Z'))).toBe('2026-11');
    expect(previousMonth('2026-11')).toBe('2026-10');
    expect(previousMonth('2026-01')).toBe('2025-12');
  });
});

describe('RN-06: só fecha mês encerrado', () => {
  it('aceita a partir do primeiro instante do mês seguinte', () => {
    expect(() => assertMonthEnded(parseMonth('2026-10'), new Date('2026-11-01T00:00:00.000Z'))).not.toThrow();
  });

  it('recusa o mês corrente e meses futuros', () => {
    expect(() => assertMonthEnded(parseMonth('2026-10'), new Date('2026-10-31T23:59:59.000Z'))).toThrow(
      'Só é possível fechar um mês que já terminou.',
    );
    expect(() => assertMonthEnded(parseMonth('2026-12'), new Date('2026-11-16T12:00:00.000Z'))).toThrow();
  });
});

describe('RN-04 e RN-05: ticket médio e variação', () => {
  it('ticket médio arredondado ao centavo e zero sem contas', () => {
    expect(averageTicketCents(10000, 3)).toBe(3333);
    expect(averageTicketCents(10001, 2)).toBe(5001);
    expect(averageTicketCents(0, 0)).toBe(0);
  });

  it('variação com uma casa decimal, para cima e para baixo', () => {
    expect(variation(15000, 10000)).toBe(50);
    expect(variation(10000, 15000)).toBe(-33.3);
    expect(variation(10000, 10000)).toBe(0);
  });

  it('com base negativa, a variação usa o valor absoluto', () => {
    expect(variation(5000, -10000)).toBe(150);
  });

  it('sem valor no mês anterior não há variação', () => {
    expect(variation(5000, 0)).toBeNull();
  });
});

describe('RN-02 e RN-03: DRE', () => {
  it('separa a receita por forma de pagamento e as despesas em compras e outras', () => {
    const dre = buildDre(
      [
        { paymentMethod: 'PIX', totalCents: 6000 },
        { paymentMethod: 'CASH', totalCents: 4550 },
        { paymentMethod: 'PIX', totalCents: 2000 },
      ],
      [
        { amountCents: 8225, fromPurchase: true },
        { amountCents: 2025, fromPurchase: false },
        { amountCents: 975, fromPurchase: false },
      ],
    );

    expect(dre).toEqual({
      revenueCents: 12550,
      paymentsCents: { CASH: 4550, CREDIT: 0, DEBIT: 0, PIX: 8000 },
      purchasesCents: 8225,
      otherExpensesCents: 3000,
      expensesCents: 11225,
      resultCents: 1325,
      paidOrders: 3,
      averageTicketCents: 4183,
    });
  });

  it('mês sem movimento fica todo zerado', () => {
    expect(buildDre([], [])).toMatchObject({ revenueCents: 0, expensesCents: 0, resultCents: 0, averageTicketCents: 0 });
  });

  it('resultado pode ser negativo', () => {
    expect(buildDre([], [{ amountCents: 150000, fromPurchase: false }]).resultCents).toBe(-150000);
  });
});

describe('RN-09: divergências', () => {
  const base = buildDre([{ paymentMethod: 'PIX', totalCents: 1000 }], [{ amountCents: 300, fromPurchase: false }]);

  it('nenhuma quando nada mudou', () => {
    expect(divergences(base, { ...base, paymentsCents: { ...base.paymentsCents } })).toEqual([]);
  });

  it('lista cada campo que mudou', () => {
    const changed = buildDre([{ paymentMethod: 'PIX', totalCents: 1000 }], [{ amountCents: 500, fromPurchase: true }, { amountCents: 300, fromPurchase: false }]);

    expect(divergences(base, changed)).toEqual(['purchases', 'result']);
  });

  it('percebe mudança em cada forma de pagamento e na contagem', () => {
    const other = buildDre(
      [{ paymentMethod: 'CASH', totalCents: 400 }, { paymentMethod: 'CREDIT', totalCents: 300 }, { paymentMethod: 'DEBIT', totalCents: 300 }],
      [{ amountCents: 300, fromPurchase: false }],
    );

    expect(divergences(base, other)).toEqual(['cash', 'credit', 'debit', 'pix', 'paidOrders', 'averageTicket']);
  });
});

describe('RN-07 e RN-08: mensagens e motivo', () => {
  it('mensagem do mês fechado mostra MM/AAAA', () => {
    expect(closedMonthMessage('2026-10')).toBe(
      'O mês 10/2026 está fechado. Reabra o fechamento para alterar lançamentos desse mês.',
    );
  });

  it('motivo de reabertura entre 5 e 300 caracteres, sem espaços sobrando', () => {
    expect(assertReopenReason('  Nota lançada errada  ')).toBe('Nota lançada errada');
    expect(() => assertReopenReason('erro')).toThrow('Informe o motivo da reabertura, de 5 a 300 caracteres.');
    expect(() => assertReopenReason(undefined)).toThrow();
    expect(() => assertReopenReason('x'.repeat(301))).toThrow();
  });
});
