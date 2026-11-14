import { describe, expect, it } from 'vitest';
import {
  assertCanReverse,
  assertItemCount,
  assertOpen,
  assertPaymentDate,
  assertPurchaseDates,
  centsToDecimal,
  isValidCnpj,
  isValidCpf,
  lineTotalCents,
  normalizeDocument,
  payableSituation,
  positiveCents,
  purchaseTotalCents,
  startOfUtcDay,
  summarizePayables,
} from '../src/purchasing/purchase-rules';
import { assertNoDuplicateIngredients } from '../src/stock/stock-rules';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const today = day('2026-11-13');

describe('RNF-01 e RN-04: dinheiro em centavos', () => {
  it.each([
    [12.5, 1250],
    ['0.01', 1],
    [3, 300],
    [{ toString: () => '45.90' }, 4590],
  ])('converte %s em %s centavos', (value, cents) => {
    expect(positiveCents(value)).toBe(cents);
  });

  it.each([0, -1, 1.005, 'abc', Number.NaN])('recusa custo %s', (value) => {
    expect(() => positiveCents(value)).toThrow('Informe um custo unitário maior que zero com até 2 casas decimais.');
  });

  it('volta para texto com 2 casas', () => {
    expect(centsToDecimal(12345)).toBe('123.45');
    expect(centsToDecimal(5)).toBe('0.05');
    expect(centsToDecimal(-250)).toBe('-2.50');
  });
});

describe('RN-05: totais da compra', () => {
  it('multiplica quantidade por custo e arredonda para o centavo mais próximo', () => {
    expect(lineTotalCents(2500, 1890)).toBe(4725);
    expect(lineTotalCents(333, 1000)).toBe(333);
    expect(lineTotalCents(1235, 101)).toBe(125);
    expect(lineTotalCents(1500, 333)).toBe(500);
    expect(lineTotalCents(1, 1)).toBe(0);
  });

  it('meio centavo arredonda para cima', () => {
    expect(lineTotalCents(500, 1)).toBe(1);
    expect(lineTotalCents(1500, 1)).toBe(2);
  });

  it('soma os itens já arredondados', () => {
    expect(
      purchaseTotalCents([
        { quantityMilli: 2500, unitCostCents: 1890 },
        { quantityMilli: 1000, unitCostCents: 3500 },
        { quantityMilli: 333, unitCostCents: 1000 },
      ]),
    ).toBe(4725 + 3500 + 333);
  });
});

describe('RN-04: itens da compra', () => {
  it('aceita de 1 a 50 itens', () => {
    expect(() => assertItemCount(1)).not.toThrow();
    expect(() => assertItemCount(50)).not.toThrow();
    expect(() => assertItemCount(0)).toThrow('A compra precisa ter de 1 a 50 itens.');
    expect(() => assertItemCount(51)).toThrow('A compra precisa ter de 1 a 50 itens.');
  });

  it('ingrediente repetido na compra cita o lugar certo', () => {
    expect(() => assertNoDuplicateIngredients([1, 1], () => 'Farinha', 'na compra')).toThrow(
      'O ingrediente Farinha aparece mais de uma vez na compra.',
    );
  });
});

describe('RN-01: CPF e CNPJ', () => {
  it.each(['529.982.247-25', '52998224725', '123.456.789-09', '11.222.333/0001-81', '11222333000181'])('aceita %s', (value) => {
    expect(normalizeDocument(value)).toMatch(/^\d+$/);
  });

  it('guarda só os dígitos', () => {
    expect(normalizeDocument(' 11.222.333/0001-81 ')).toBe('11222333000181');
  });

  it('documento vazio vira nulo', () => {
    expect(normalizeDocument(undefined)).toBeNull();
    expect(normalizeDocument('   ')).toBeNull();
  });

  it.each(['529.982.247-24', '111.111.111-11', '11.222.333/0001-80', '00000000000000', '123', 'abc52998224725'])(
    'recusa %s',
    (value) => {
      expect(() => normalizeDocument(value)).toThrow('CPF ou CNPJ inválido.');
    },
  );

  it('confere os dois dígitos verificadores', () => {
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('52998224715')).toBe(false);
    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('11222333000191')).toBe(false);
    expect(isValidCpf('11222333000181')).toBe(false);
  });
});

describe('RN-06 e RN-11: datas', () => {
  it('leva qualquer horário para o início do dia em UTC', () => {
    expect(startOfUtcDay(new Date('2026-11-13T23:59:00.000Z')).toISOString()).toBe('2026-11-13T00:00:00.000Z');
  });

  it('compra de hoje ou de antes, vencendo no mesmo dia ou depois', () => {
    expect(() => assertPurchaseDates(today, today, today)).not.toThrow();
    expect(() => assertPurchaseDates(day('2026-11-01'), day('2026-12-01'), today)).not.toThrow();
  });

  it('recusa compra futura e vencimento antes da compra', () => {
    expect(() => assertPurchaseDates(day('2026-11-14'), day('2026-11-20'), today)).toThrow(
      'A data da compra não pode ser futura.',
    );
    expect(() => assertPurchaseDates(day('2026-11-10'), day('2026-11-09'), today)).toThrow(
      'O vencimento não pode ser antes da data da compra.',
    );
  });

  it('pagamento entre a data da compra e hoje', () => {
    expect(() => assertPaymentDate(today, day('2026-11-10'), today)).not.toThrow();
    expect(() => assertPaymentDate(day('2026-11-10'), day('2026-11-10'), today)).not.toThrow();
    expect(() => assertPaymentDate(day('2026-11-14'), day('2026-11-10'), today)).toThrow(
      'A data do pagamento não pode ser futura.',
    );
    expect(() => assertPaymentDate(day('2026-11-09'), day('2026-11-10'), today)).toThrow(
      'O pagamento não pode ser antes da data da compra.',
    );
  });
});

describe('RN-08 e RN-09: pagar, cancelar e estornar', () => {
  it('só compra em aberto', () => {
    expect(() => assertOpen('OPEN')).not.toThrow();
    expect(() => assertOpen('PAID')).toThrow('Só compras em aberto podem ser pagas ou canceladas.');
    expect(() => assertOpen('CANCELLED')).toThrow('Só compras em aberto podem ser pagas ou canceladas.');
  });

  it('estorno exige estoque suficiente', () => {
    expect(() => assertCanReverse(5000, 5000, 'Filhote')).not.toThrow();
    expect(() => assertCanReverse(4999, 5000, 'Filhote')).toThrow(
      'Não é possível cancelar: o estoque de Filhote já foi usado.',
    );
  });
});

describe('RN-07 e RF-07: contas a pagar', () => {
  it('situação em relação a hoje', () => {
    expect(payableSituation(day('2026-11-12'), today)).toBe('OVERDUE');
    expect(payableSituation(today, today)).toBe('DUE_TODAY');
    expect(payableSituation(day('2026-11-14'), today)).toBe('UPCOMING');
  });

  it('resumo separa vencido e próximos 7 dias (hoje e os 6 seguintes)', () => {
    const summary = summarizePayables(
      [
        { dueDate: day('2026-11-01'), totalCents: 1000 },
        { dueDate: day('2026-11-12'), totalCents: 2000 },
        { dueDate: today, totalCents: 300 },
        { dueDate: day('2026-11-19'), totalCents: 40 },
        { dueDate: day('2026-11-20'), totalCents: 5 },
      ],
      today,
    );

    expect(summary).toEqual({ count: 5, openCents: 3345, overdueCents: 3000, dueNext7DaysCents: 340 });
  });

  it('sem contas, tudo zerado', () => {
    expect(summarizePayables([], today)).toEqual({ count: 0, openCents: 0, overdueCents: 0, dueNext7DaysCents: 0 });
  });
});
