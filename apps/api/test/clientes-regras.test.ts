import { describe, expect, it } from 'vitest';
import {
  customerHistory,
  customerName,
  customerNotes,
  customerPhone,
  dedupeKey,
  nameKey,
  PaidOrder,
  searchTerms,
} from '../src/customers/customer-rules';

// Regras puras de clientes (SPEC/2026-11-16-clientes-e-historico.md). Nomes e números são fictícios.
describe('RN-01: nome', () => {
  it('tira espaços das pontas e reduz espaços repetidos', () => {
    expect(customerName('  Maria   da  Silva ')).toBe('Maria da Silva');
    expect(customerName('Lu')).toBe('Lu');
    expect(customerName('x'.repeat(80))).toHaveLength(80);
  });

  it.each([undefined, null, 42, '', ' A ', 'x'.repeat(81)])('recusa %s', (value) => {
    expect(() => customerName(value)).toThrow('Informe o nome do cliente, de 2 a 80 caracteres.');
  });
});

describe('RN-04: chave do nome', () => {
  it('ignora maiúsculas, acentos e espaços', () => {
    expect(nameKey('  JOÃO   Conceição ')).toBe('joao conceicao');
    expect(nameKey('Ângela Müller')).toBe('angela muller');
  });

  it('junta nome e telefone; sem telefone, a parte do telefone fica vazia', () => {
    expect(dedupeKey('João Conceição', '91988887777')).toBe('joao conceicao|91988887777');
    expect(dedupeKey('Joao Conceicao', null)).toBe('joao conceicao|');
    expect(dedupeKey('Ana', null)).not.toBe(dedupeKey('Ana', '9133334444'));
  });
});

describe('RN-02: telefone (P-1)', () => {
  it.each([
    ['(91) 98888-7777', '91988887777'],
    ['91 3333-4444', '9133334444'],
    ['+55 91 98888-7777', '91988887777'],
    ['5591988887777', '91988887777'],
    ['559133334444', '9133334444'],
    ['91988887777', '91988887777'],
    ['(55) 99999-8888', '55999998888'],
    ['55 3222-1111', '5532221111'],
  ])('guarda %s como %s', (value, digits) => {
    expect(customerPhone(value)).toBe(digits);
  });

  it('é opcional', () => {
    expect(customerPhone(undefined)).toBeNull();
    expect(customerPhone(null)).toBeNull();
    expect(customerPhone('   ')).toBeNull();
  });

  it.each(['123456789', '919888877776', 'nove um', '91 9888a-7777', 91988887777, '+1 91 98888-7777'])('recusa %s', (value) => {
    expect(() => customerPhone(value)).toThrow('Informe o telefone com DDD, com 10 ou 11 dígitos.');
  });
});

describe('RN-03: observação', () => {
  it('é opcional e tem até 300 caracteres', () => {
    expect(customerNotes(undefined)).toBeNull();
    expect(customerNotes(null)).toBeNull();
    expect(customerNotes('  ')).toBeNull();
    expect(customerNotes(' prefere mesa na varanda ')).toBe('prefere mesa na varanda');
    expect(customerNotes('x'.repeat(300))).toHaveLength(300);
    expect(() => customerNotes('x'.repeat(301))).toThrow('A observação deve ter até 300 caracteres.');
    expect(() => customerNotes(7)).toThrow('A observação deve ter até 300 caracteres.');
  });
});

describe('RF-02: termo de busca', () => {
  it('serve para nome e, com 2 dígitos ou mais, para telefone', () => {
    expect(searchTerms('  Conceição ')).toEqual({ name: 'conceicao', digits: null });
    expect(searchTerms('9888')).toEqual({ name: '9888', digits: '9888' });
    expect(searchTerms('(91) 9')).toEqual({ name: '(91) 9', digits: '919' });
    expect(searchTerms('a1')).toEqual({ name: 'a1', digits: null });
  });

  it('sem termo, não filtra', () => {
    expect(searchTerms(undefined)).toBeNull();
    expect(searchTerms('   ')).toBeNull();
    expect(searchTerms(['ana'])).toBeNull();
  });
});

describe('RF-05, RN-07 e RN-08: histórico', () => {
  const order = (id: number, day: string, totalCents: number, items: [string, number][], tableNumber = 1): PaidOrder => ({
    id,
    paidAt: new Date(`2026-11-${day}T20:00:00.000Z`),
    tableNumber,
    totalCents,
    items: items.map(([name, quantity]) => ({ name, quantity })),
  });

  it('soma visitas, total e ticket médio e guarda primeira e última visita', () => {
    const history = customerHistory([
      order(3, '14', 4550, [['Tacacá', 1]], 4),
      order(1, '02', 10000, [['Tacacá', 2], ['Suco', 1]], 2),
      order(2, '10', 3333, [['Suco', 1]], 3),
    ]);
    expect(history).toMatchObject({
      visits: 3,
      totalSpent: '178.83',
      averageTicket: '59.61',
      firstVisit: new Date('2026-11-02T20:00:00.000Z'),
      lastVisit: new Date('2026-11-14T20:00:00.000Z'),
    });
    expect(history.orders).toEqual([
      { id: 3, paidAt: new Date('2026-11-14T20:00:00.000Z'), tableNumber: 4, total: '45.50' },
      { id: 2, paidAt: new Date('2026-11-10T20:00:00.000Z'), tableNumber: 3, total: '33.33' },
      { id: 1, paidAt: new Date('2026-11-02T20:00:00.000Z'), tableNumber: 2, total: '100.00' },
    ]);
  });

  it('lista os 3 itens mais pedidos, com empate em ordem alfabética', () => {
    const history = customerHistory([
      order(1, '01', 1, [['Vatapá', 2], ['Açaí', 2], ['Suco', 5], ['Bolo', 1], ['Maniçoba', 2]]),
    ]);
    expect(history.favorites).toEqual([
      { name: 'Suco', quantity: 5 },
      { name: 'Açaí', quantity: 2 },
      { name: 'Maniçoba', quantity: 2 },
    ]);
  });

  it('desempata comandas pagas no mesmo instante pelo número', () => {
    const history = customerHistory([order(9, '05', 100, []), order(4, '05', 100, [])]);
    expect(history.orders.map((o) => o.id)).toEqual([9, 4]);
  });

  it('sem visitas, tudo zera', () => {
    expect(customerHistory([])).toEqual({
      visits: 0,
      totalSpent: '0.00',
      averageTicket: '0.00',
      firstVisit: null,
      lastVisit: null,
      favorites: [],
      orders: [],
    });
  });
});
