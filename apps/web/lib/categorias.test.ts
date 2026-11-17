import { describe, expect, it } from 'vitest';
import {
  canDelete, canMove, categoryKey, categoryName, categoryOptions, findDuplicate, importMessage,
  INVALID_NAME, DUPLICATE_NAME, itemCountLabel, moveCategory, sortCategories, summarizeCategories,
  validateCategoryName, type MenuCategory,
} from './categorias';

const category = (overrides: Partial<MenuCategory> = {}): MenuCategory => ({
  id: 1, name: 'Bebidas', sortOrder: 0, itemCount: 0, ...overrides,
});

const list: MenuCategory[] = [
  category({ id: 3, name: 'Sobremesas', sortOrder: 2, itemCount: 2 }),
  category({ id: 1, name: 'Entradas', sortOrder: 0, itemCount: 1 }),
  category({ id: 2, name: 'Pratos principais', sortOrder: 1, itemCount: 4 }),
];

describe('nome da categoria (RN-01)', () => {
  it('reduz espaços repetidos e apara as pontas', () => {
    expect(categoryName('  Pratos   principais ')).toBe('Pratos principais');
  });

  it('aceita nome de 2 a 50 caracteres', () => {
    expect(validateCategoryName('Bebidas')).toBeNull();
    expect(validateCategoryName('  Be  ')).toBeNull();
    expect(validateCategoryName('a'.repeat(50))).toBeNull();
  });

  it('recusa nome curto, longo ou vazio com a mensagem da API', () => {
    expect(validateCategoryName('a')).toBe(INVALID_NAME);
    expect(validateCategoryName('   ')).toBe(INVALID_NAME);
    expect(validateCategoryName('a'.repeat(51))).toBe(INVALID_NAME);
  });
});

describe('nome repetido (RN-02)', () => {
  it('compara sem maiúsculas, acentos e espaços extras', () => {
    expect(categoryKey('  Sobremesas ')).toBe('sobremesas');
    expect(categoryKey('Açaí')).toBe('acai');
    expect(findDuplicate(list, 'entradas')?.id).toBe(1);
    expect(findDuplicate(list, 'SOBREMESAS')?.id).toBe(3);
    expect(findDuplicate(list, 'Bebidas')).toBeNull();
  });

  it('usa a chave da API quando ela vem na lista', () => {
    const withKey = [category({ id: 9, name: 'Sobremesas', nameKey: 'sobremesas' })];
    expect(findDuplicate(withKey, 'Sobremesas')).not.toBeNull();
  });

  it('ignora a própria categoria ao renomear', () => {
    expect(findDuplicate(list, 'Sobremesas', 3)).toBeNull();
    expect(findDuplicate(list, 'Sobremesas', 1)).not.toBeNull();
  });

  it('a mensagem é a da API', () => {
    expect(DUPLICATE_NAME).toBe('Já existe uma categoria com esse nome.');
  });
});

describe('ordem da lista (RF-01 e RF-04)', () => {
  it('ordena por sortOrder e depois por id', () => {
    expect(sortCategories(list).map((entry) => entry.name)).toEqual(['Entradas', 'Pratos principais', 'Sobremesas']);
    expect(sortCategories([category({ id: 5, sortOrder: 1 }), category({ id: 4, sortOrder: 1 })]).map((entry) => entry.id)).toEqual([4, 5]);
  });

  it('não altera o array recebido', () => {
    const original = [...list];
    sortCategories(list);
    expect(list).toEqual(original);
  });

  it('move para cima e para baixo trocando uma posição', () => {
    expect(moveCategory(list, 2, 'up')).toEqual([2, 1, 3]);
    expect(moveCategory(list, 2, 'down')).toEqual([1, 3, 2]);
  });

  it('devolve a lista completa, uma vez cada, e não move nas pontas', () => {
    expect(moveCategory(list, 1, 'up')).toEqual([1, 2, 3]);
    expect(moveCategory(list, 3, 'down')).toEqual([1, 2, 3]);
    expect(moveCategory(list, 99, 'up')).toEqual([1, 2, 3]);
    expect(new Set(moveCategory(list, 1, 'down')).size).toBe(3);
  });

  it('sabe quando cada botão deve estar habilitado (RNF-01)', () => {
    expect(canMove(list, 1, 'up')).toBe(false);
    expect(canMove(list, 1, 'down')).toBe(true);
    expect(canMove(list, 2, 'up')).toBe(true);
    expect(canMove(list, 2, 'down')).toBe(true);
    expect(canMove(list, 3, 'down')).toBe(false);
    expect(canMove(list, 99, 'up')).toBe(false);
  });
});

describe('resumo e apagar (RF-05)', () => {
  it('soma itens ligados e conta as vazias', () => {
    const summary = summarizeCategories([...list, category({ id: 4, name: 'Sem itens', sortOrder: 3 })]);
    expect(summary).toEqual({ total: 4, linkedItems: 7, empty: 1 });
    expect(summarizeCategories([])).toEqual({ total: 0, linkedItems: 0, empty: 0 });
  });

  it('só deixa apagar categoria sem itens', () => {
    expect(canDelete(category({ itemCount: 0 }))).toBe(true);
    expect(canDelete(category({ itemCount: 2 }))).toBe(false);
    expect(canDelete({ id: 1, name: 'X', sortOrder: 0 })).toBe(true);
  });

  it('escreve a contagem no singular e no plural', () => {
    expect(itemCountLabel(0)).toBe('0 itens');
    expect(itemCountLabel(1)).toBe('1 item');
    expect(itemCountLabel(3)).toBe('3 itens');
  });
});

describe('resumo da importação (RF-06)', () => {
  it('informa categorias criadas e itens ligados', () => {
    expect(importMessage({ created: ['Bebidas'], linkedItems: 3 })).toBe('Importação concluída: 1 categoria criada e 3 itens ligados.');
    expect(importMessage({ created: ['Bebidas', 'Entradas'], linkedItems: 1 })).toBe('Importação concluída: 2 categorias criadas e 1 item ligado.');
  });

  it('avisa quando não havia nada para importar', () => {
    expect(importMessage({ created: [], linkedItems: 0 })).toBe('Nada para importar: os itens já estão em categorias cadastradas.');
    expect(importMessage({})).toBe('Nada para importar: os itens já estão em categorias cadastradas.');
  });
});

describe('sugestões do formulário de item (RF-07)', () => {
  it('lista as categorias na ordem', () => {
    expect(categoryOptions(list, '')).toEqual(['Entradas', 'Pratos principais', 'Sobremesas']);
  });

  it('não repete a categoria digitada', () => {
    expect(categoryOptions(list, 'sobremesas')).toEqual(['Entradas', 'Pratos principais', 'Sobremesas']);
  });

  it('inclui o texto novo no fim', () => {
    expect(categoryOptions(list, 'Lanches')).toEqual(['Entradas', 'Pratos principais', 'Sobremesas', 'Lanches']);
  });
});
