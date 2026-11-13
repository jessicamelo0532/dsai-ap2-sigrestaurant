import { describe, expect, it } from 'vitest';
import {
  applyLoss,
  assertNoDuplicateIngredients,
  COUNT_MESSAGE,
  formatQuantity,
  fromMilli,
  nonNegativeMilli,
  portionsAvailable,
  positiveMilli,
  requiredForSale,
  stockAlerts,
  toMilli,
} from '../src/stock/stock-rules';

describe('RNF-01: quantidades em milésimos', () => {
  it.each([
    [0.25, 250],
    ['1.5', 1500],
    ['0.001', 1],
    [2, 2000],
    [{ toString: () => '12.340' }, 12340],
    [-0.5, -500],
  ])('converte %s em %s milésimos', (value, milli) => {
    expect(toMilli(value)).toBe(milli);
  });

  it('não acumula erro de arredondamento ao somar', () => {
    expect(toMilli(0.1) + toMilli(0.2)).toBe(toMilli(0.3));
  });

  it.each([0.0001, '1.2345', 'abc', Number.NaN, Number.POSITIVE_INFINITY])('recusa %s', (value) => {
    expect(() => toMilli(value)).toThrow('Informe uma quantidade maior que zero com até 3 casas decimais.');
  });

  it('volta para texto com 3 casas, inclusive negativo', () => {
    expect(fromMilli(250)).toBe('0.250');
    expect(fromMilli(12340)).toBe('12.340');
    expect(fromMilli(-500)).toBe('-0.500');
    expect(fromMilli(0)).toBe('0.000');
  });

  it('formata para mensagens com vírgula e unidade', () => {
    expect(formatQuantity(1250, 'KG')).toBe('1,250 kg');
    expect(formatQuantity(3000, 'UN')).toBe('3,000 un');
    expect(formatQuantity(500, 'ML')).toBe('0,500 mL');
  });
});

describe('RN-02 e RN-04: quantidades válidas', () => {
  it('entrada, perda e ficha técnica exigem mais que zero', () => {
    expect(positiveMilli(0.001)).toBe(1);
    expect(() => positiveMilli(0)).toThrow('maior que zero');
    expect(() => positiveMilli(-1)).toThrow('maior que zero');
  });

  it('contagem e mínimo aceitam zero, mas não negativo', () => {
    expect(nonNegativeMilli(0, COUNT_MESSAGE)).toBe(0);
    expect(nonNegativeMilli('3.5', COUNT_MESSAGE)).toBe(3500);
    expect(() => nonNegativeMilli(-0.001, COUNT_MESSAGE)).toThrow(COUNT_MESSAGE);
    expect(() => nonNegativeMilli('1.2345', COUNT_MESSAGE)).toThrow(COUNT_MESSAGE);
  });
});

describe('RN-03: perda', () => {
  const fish = { name: 'Filhote', unit: 'KG' as const };

  it('desconta e pode zerar o estoque', () => {
    expect(applyLoss(2000, 500, fish)).toBe(1500);
    expect(applyLoss(2000, 2000, fish)).toBe(0);
  });

  it('recusa perda maior que o estoque', () => {
    expect(() => applyLoss(1250, 1251, fish)).toThrow('Estoque insuficiente: há 1,250 kg de Filhote.');
  });
});

describe('RN-06: ficha técnica sem repetição', () => {
  const names = new Map([
    [1, 'Farinha'],
    [2, 'Tucupi'],
  ]);

  it('aceita ingredientes diferentes e lista vazia', () => {
    expect(() => assertNoDuplicateIngredients([1, 2], (id) => names.get(id)!)).not.toThrow();
    expect(() => assertNoDuplicateIngredients([], (id) => names.get(id)!)).not.toThrow();
  });

  it('recusa ingrediente repetido citando o nome', () => {
    expect(() => assertNoDuplicateIngredients([1, 2, 2], (id) => names.get(id)!)).toThrow(
      'O ingrediente Tucupi aparece mais de uma vez na ficha técnica.',
    );
  });
});

describe('RN-07: porções possíveis', () => {
  it('prato sem ficha técnica não tem cálculo', () => {
    expect(portionsAvailable([])).toBeNull();
  });

  it('usa o ingrediente que acaba primeiro e arredonda para baixo', () => {
    expect(
      portionsAvailable([
        { stockMilli: 2000, perPortionMilli: 200 },
        { stockMilli: 7500, perPortionMilli: 1000 },
      ]),
    ).toBe(7);
  });

  it('nunca devolve menos que zero, mesmo com estoque negativo', () => {
    expect(portionsAvailable([{ stockMilli: -300, perPortionMilli: 200 }])).toBe(0);
    expect(portionsAvailable([{ stockMilli: 199, perPortionMilli: 200 }])).toBe(0);
  });
});

describe('RF-08 e RN-08: baixa da venda', () => {
  const recipes = [
    { menuItemId: 10, ingredientId: 1, perPortionMilli: 200 },
    { menuItemId: 10, ingredientId: 2, perPortionMilli: 1000 },
    { menuItemId: 20, ingredientId: 2, perPortionMilli: 500 },
  ];

  it('multiplica pela quantidade e soma o mesmo ingrediente de pratos diferentes', () => {
    const required = requiredForSale(
      [
        { menuItemId: 10, quantity: 2 },
        { menuItemId: 20, quantity: 3 },
      ],
      recipes,
    );

    expect([...required.entries()]).toEqual([
      [1, 400],
      [2, 3500],
    ]);
  });

  it('ignora item que saiu do cardápio e prato sem ficha', () => {
    const required = requiredForSale(
      [
        { menuItemId: null, quantity: 5 },
        { menuItemId: 30, quantity: 1 },
      ],
      recipes,
    );

    expect(required.size).toBe(0);
  });
});

describe('RF-06: alertas de estoque', () => {
  const item = (name: string, quantityMilli: number, minimumMilli: number) => ({ name, quantityMilli, minimumMilli });

  it('mostra só quem está no mínimo ou abaixo, com negativos primeiro', () => {
    const alerts = stockAlerts([
      item('Açaí', 5000, 2000),
      item('Farinha', 1000, 3000),
      item('Jambu', -200, 0),
      item('Tucupi', 2000, 2000),
      item('Camarão', 0, 4000),
      item('Peixe', -100, 5000),
    ]);

    expect(alerts.map((alert) => alert.name)).toEqual(['Peixe', 'Jambu', 'Camarão', 'Farinha', 'Tucupi']);
  });

  it('desempata por nome', () => {
    const alerts = stockAlerts([item('Pimenta', 0, 1000), item('Alho', 0, 1000)]);

    expect(alerts.map((alert) => alert.name)).toEqual(['Alho', 'Pimenta']);
  });
});
