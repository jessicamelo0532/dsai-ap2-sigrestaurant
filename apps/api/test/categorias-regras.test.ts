import { describe, expect, it } from 'vitest';
import {
  categoryKey,
  categoryName,
  compareMenu,
  deleteBlockedMessage,
  fullOrder,
  importPlan,
  MenuEntry,
} from '../src/menu-categories/category-rules';

// Regras puras das categorias do cardápio (SPEC/2026-11-16-categorias-do-cardapio.md).
describe('RN-01 e RN-02: nome e chave', () => {
  it('limpa espaços e compara sem maiúsculas e acentos', () => {
    expect(categoryName('  Pratos   principais ')).toBe('Pratos principais');
    expect(categoryName('Ab')).toBe('Ab');
    expect(categoryName('x'.repeat(50))).toHaveLength(50);
    expect(categoryKey('Sobremesas Típicas')).toBe(categoryKey('sobremesas  tipicas'));
  });

  it.each([undefined, 3, '', ' B ', 'x'.repeat(51)])('recusa %s', (value) => {
    expect(() => categoryName(value)).toThrow('Informe o nome da categoria, de 2 a 50 caracteres.');
  });
});

describe('RN-03: nova ordem', () => {
  it('aceita todas as categorias uma vez cada', () => {
    expect(fullOrder([3, 1, 2], [1, 2, 3])).toEqual([3, 1, 2]);
    expect(fullOrder([], [])).toEqual([]);
  });

  it.each([
    [[1, 2], [1, 2, 3]],
    [[1, 2, 3, 4], [1, 2, 3]],
    [[1, 1, 2], [1, 2, 3]],
    [[1, 2, 9], [1, 2, 3]],
    [[1, '2', 3], [1, 2, 3]],
    ['1,2,3', [1, 2, 3]],
    [undefined, []],
  ])('recusa %j quando existem %j', (ids, existing) => {
    expect(() => fullOrder(ids, existing)).toThrow('Informe todas as categorias, uma vez cada, na nova ordem.');
  });
});

describe('RN-04: apagar com itens', () => {
  it('diz quantos itens a categoria tem, no singular e no plural', () => {
    expect(deleteBlockedMessage(1)).toBe('Esta categoria tem 1 item. Mova os itens antes de apagá-la.');
    expect(deleteBlockedMessage(3)).toBe('Esta categoria tem 3 itens. Mova os itens antes de apagá-la.');
  });
});

describe('RF-08 e P-2: ordem do cardápio', () => {
  const entry = (name: string, category: string, categoryOrder: number | null): MenuEntry => ({ name, category, categoryOrder });

  it('categorias cadastradas na ordem do cadastro, depois as sem cadastro pelo texto, e itens por nome', () => {
    const menu = [
      entry('Suco', 'Bebidas', 2),
      entry('Água', 'Bebidas', 2),
      entry('Pudim', 'Avulsos', null),
      entry('Tacacá', 'Entradas', 0),
      entry('Café', 'Avulsos', null),
      entry('Maniçoba', 'Pratos', 1),
      entry('Zimbro', 'Agrados', null),
    ];
    expect([...menu].sort(compareMenu).map((e) => e.name)).toEqual([
      'Tacacá', 'Maniçoba', 'Água', 'Suco', 'Zimbro', 'Café', 'Pudim',
    ]);
  });
});

describe('RN-07: importação', () => {
  it('cria uma categoria por texto, preferindo a grafia com maiúscula, em ordem alfabética', () => {
    expect(importPlan(['bebidas', 'Pratos', 'Bebidas', ' Entradas ', 'pratos'], new Set())).toEqual([
      { key: 'bebidas', name: 'Bebidas' },
      { key: 'entradas', name: 'Entradas' },
      { key: 'pratos', name: 'Pratos' },
    ]);
  });

  it('não recria categorias que já existem e ignora textos inválidos', () => {
    expect(importPlan(['Sobremesas', 'sobremésas', 'Bebidas', 'X', 'y'.repeat(51)], new Set(['bebidas']))).toEqual([
      { key: 'sobremesas', name: 'Sobremesas' },
    ]);
    expect(importPlan([], new Set())).toEqual([]);
  });
});
