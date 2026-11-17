// Tela de categorias do cardápio (SPEC/2026-11-17-tela-de-categorias.md).
// Funções puras: recebem a lista como GET /menu-categories devolve e preparam a tela.

export type MenuCategory = {
  id: number;
  name: string;
  nameKey?: string;
  sortOrder: number;
  createdAt?: string;
  itemCount?: number;
};

export const CATEGORY_NAME_MIN = 2;
export const CATEGORY_NAME_MAX = 50;

export const INVALID_NAME = 'Informe o nome da categoria, de 2 a 50 caracteres.';
export const DUPLICATE_NAME = 'Já existe uma categoria com esse nome.';
export const EMPTY_LIST = 'Nenhuma categoria cadastrada ainda.';

// RN-01: mesmo recorte da API (espaços repetidos viram um).
export function categoryName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

// RN-01: valida antes de chamar a API, com a mesma mensagem.
export function validateCategoryName(value: string): string | null {
  const name = categoryName(value);
  return name.length < CATEGORY_NAME_MIN || name.length > CATEGORY_NAME_MAX ? INVALID_NAME : null;
}

// RN-02: mesma chave da API (sem maiúsculas, acentos e espaços extras).
export function categoryKey(value: string): string {
  return categoryName(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// RN-02: nome repetido é bloqueado localmente; renomear ignora a própria categoria.
export function findDuplicate(categories: readonly MenuCategory[], value: string, exceptId?: number): MenuCategory | null {
  const key = categoryKey(value);
  return categories.find((category) => category.id !== exceptId && (category.nameKey ?? categoryKey(category.name)) === key) ?? null;
}

// RF-01: ordem da API (sortOrder, depois id), sem confiar na ordem do array.
export function sortCategories(categories: readonly MenuCategory[]): MenuCategory[] {
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

// RF-04 e RN-03: devolve a lista completa com a categoria deslocada uma posição.
export function moveCategory(categories: readonly MenuCategory[], id: number, direction: 'up' | 'down'): number[] {
  const ids = sortCategories(categories).map((category) => category.id);
  const from = ids.indexOf(id);
  if (from < 0) return ids;
  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return ids;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}

export function canMove(categories: readonly MenuCategory[], id: number, direction: 'up' | 'down'): boolean {
  const ids = sortCategories(categories).map((category) => category.id);
  const from = ids.indexOf(id);
  return direction === 'up' ? from > 0 : from >= 0 && from < ids.length - 1;
}

// RF-05: a recusa de apagar com itens é da API; aqui só evitamos o clique inútil.
export function canDelete(category: MenuCategory): boolean {
  return (category.itemCount ?? 0) === 0;
}

export function itemCountLabel(count: number): string {
  return count === 1 ? '1 item' : `${count} itens`;
}

export type CategorySummary = { total: number; linkedItems: number; empty: number };

export function summarizeCategories(categories: readonly MenuCategory[]): CategorySummary {
  return {
    total: categories.length,
    linkedItems: categories.reduce((total, category) => total + (category.itemCount ?? 0), 0),
    empty: categories.filter((category) => (category.itemCount ?? 0) === 0).length,
  };
}

// RF-06: resumo da importação devolvido pela API ({ created: string[], linkedItems }).
export type ImportResult = { created?: string[]; linkedItems?: number };

export function importMessage(result: ImportResult): string {
  const created = result.created?.length ?? 0;
  const linked = result.linkedItems ?? 0;
  if (!created && !linked) return 'Nada para importar: os itens já estão em categorias cadastradas.';
  const parts = [
    created ? `${created} ${created === 1 ? 'categoria criada' : 'categorias criadas'}` : null,
    linked ? `${linked} ${linked === 1 ? 'item ligado' : 'itens ligados'}` : null,
  ].filter(Boolean).join(' e ');
  return `Importação concluída: ${parts}.`;
}

// RF-07: sugestões do formulário de item, sem repetir e sem impedir texto novo.
export function categoryOptions(categories: readonly MenuCategory[], current: string): string[] {
  const names = sortCategories(categories).map((category) => category.name);
  const text = categoryName(current);
  return text && !names.some((name) => categoryKey(name) === categoryKey(text)) ? [...names, text] : names;
}
