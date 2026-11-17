// Regras puras das categorias do cardápio (SPEC/2026-11-16-categorias-do-cardapio.md).
import { BadRequestException } from '@nestjs/common';
import { nameKey } from '../customers/customer-rules';

export const NAME_MESSAGE = 'Informe o nome da categoria, de 2 a 50 caracteres.';
export const DUPLICATE_MESSAGE = 'Já existe uma categoria com esse nome.';
export const ORDER_MESSAGE = 'Informe todas as categorias, uma vez cada, na nova ordem.';

// RN-01
export function categoryName(value: unknown) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 50) throw new BadRequestException(NAME_MESSAGE);
  return name;
}

// RN-02: a mesma chave usada no cadastro de clientes (sem maiúsculas, acentos e espaços extras).
export const categoryKey = nameKey;

// RN-03: a nova ordem tem todas as categorias, uma vez cada.
export function fullOrder(ids: unknown, existing: readonly number[]): number[] {
  if (!Array.isArray(ids) || ids.length !== existing.length) throw new BadRequestException(ORDER_MESSAGE);
  const known = new Set(existing);
  const seen = new Set<number>();
  for (const id of ids) {
    if (typeof id !== 'number' || !known.has(id) || seen.has(id)) throw new BadRequestException(ORDER_MESSAGE);
    seen.add(id);
  }
  return ids as number[];
}

// RN-04
export function deleteBlockedMessage(itemCount: number) {
  return `Esta categoria tem ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}. Mova os itens antes de apagá-la.`;
}

export interface MenuEntry {
  name: string;
  category: string;
  categoryOrder: number | null;
}

// RF-08 e P-2: categorias cadastradas na ordem do cadastro; sem categoria cadastrada, depois, pelo texto.
export function compareMenu(a: MenuEntry, b: MenuEntry) {
  const rank = (entry: MenuEntry) => (entry.categoryOrder === null ? 1 : 0);
  return (
    rank(a) - rank(b) ||
    (a.categoryOrder ?? 0) - (b.categoryOrder ?? 0) ||
    a.category.localeCompare(b.category, 'pt-BR') ||
    a.name.localeCompare(b.name, 'pt-BR')
  );
}

// RN-07: uma categoria por texto; vence a grafia que vem primeiro na ordem dos caracteres (maiúscula antes),
// e as novas são criadas em ordem alfabética.
export function importPlan(texts: readonly string[], existingKeys: ReadonlySet<string>) {
  const byKey = new Map<string, string>();
  for (const raw of texts) {
    const text = raw.trim().replace(/\s+/g, ' ');
    if (text.length < 2 || text.length > 50) continue;
    const key = categoryKey(text);
    const current = byKey.get(key);
    if (current === undefined || text < current) byKey.set(key, text);
  }
  return [...byKey.entries()]
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
