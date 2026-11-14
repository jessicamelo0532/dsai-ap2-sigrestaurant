import { BadRequestException } from '@nestjs/common';

// Regras puras do estoque (SPEC/2026-11-13-estoque-de-ingredientes.md).
// Quantidades viram milésimos inteiros (RNF-01): 0,250 kg = 250.

export type StockUnit = 'UN' | 'KG' | 'G' | 'L' | 'ML';
export const STOCK_UNITS: StockUnit[] = ['UN', 'KG', 'G', 'L', 'ML'];
const UNIT_LABEL: Record<StockUnit, string> = { UN: 'un', KG: 'kg', G: 'g', L: 'L', ML: 'mL' };

export const POSITIVE_QUANTITY_MESSAGE = 'Informe uma quantidade maior que zero com até 3 casas decimais.';
export const COUNT_MESSAGE = 'Informe a quantidade contada, zero ou mais, com até 3 casas decimais.';
export const MINIMUM_MESSAGE = 'Informe o estoque mínimo, zero ou mais, com até 3 casas decimais.';

// Aceita número, texto ou Decimal do Prisma (qualquer valor com toString).
export function toMilli(value: number | string | { toString(): string }, message = POSITIVE_QUANTITY_MESSAGE): number {
  const number = Number(typeof value === 'number' ? value : value.toString());
  if (!Number.isFinite(number)) throw new BadRequestException(message);
  const milli = Math.round(number * 1000);
  if (Math.abs(number * 1000 - milli) > 1e-6) throw new BadRequestException(message);
  return milli;
}

// RN-02: maior que zero.
export function positiveMilli(value: number | string): number {
  const milli = toMilli(value, POSITIVE_QUANTITY_MESSAGE);
  if (milli <= 0) throw new BadRequestException(POSITIVE_QUANTITY_MESSAGE);
  return milli;
}

// RN-01 e RN-04: zero ou mais.
export function nonNegativeMilli(value: number | string, message: string): number {
  const milli = toMilli(value, message);
  if (milli < 0) throw new BadRequestException(message);
  return milli;
}

// Volta para texto com 3 casas, formato aceito pelo Decimal do Prisma.
export function fromMilli(milli: number): string {
  const sign = milli < 0 ? '-' : '';
  const absolute = Math.abs(milli);
  return `${sign}${Math.floor(absolute / 1000)}.${String(absolute % 1000).padStart(3, '0')}`;
}

// Para mensagens: "1,250 kg".
export function formatQuantity(milli: number, unit: StockUnit): string {
  return `${fromMilli(milli).replace('.', ',')} ${UNIT_LABEL[unit]}`;
}

// RN-03: perda não deixa o estoque negativo.
export function applyLoss(currentMilli: number, lossMilli: number, ingredient: { name: string; unit: StockUnit }): number {
  if (lossMilli > currentMilli) {
    throw new BadRequestException(
      `Estoque insuficiente: há ${formatQuantity(currentMilli, ingredient.unit)} de ${ingredient.name}.`,
    );
  }
  return currentMilli - lossMilli;
}

// RN-06: ingrediente não repete na ficha técnica.
export function assertNoDuplicateIngredients(ingredientIds: number[], nameOf: (id: number) => string): void {
  const seen = new Set<number>();
  for (const id of ingredientIds) {
    if (seen.has(id)) {
      throw new BadRequestException(`O ingrediente ${nameOf(id)} aparece mais de uma vez na ficha técnica.`);
    }
    seen.add(id);
  }
}

// RN-07: menor quantidade de porções entre os ingredientes; sem ficha, sem cálculo.
export function portionsAvailable(recipe: { stockMilli: number; perPortionMilli: number }[]): number | null {
  if (!recipe.length) return null;
  const portions = Math.min(...recipe.map((item) => Math.floor(item.stockMilli / item.perPortionMilli)));
  return Math.max(0, portions);
}

// RF-08 e RN-08: total a baixar por ingrediente para os itens vendidos.
export function requiredForSale(
  lines: { menuItemId: number | null; quantity: number }[],
  recipes: { menuItemId: number; ingredientId: number; perPortionMilli: number }[],
): Map<number, number> {
  const required = new Map<number, number>();
  for (const line of lines) {
    if (line.menuItemId === null) continue;
    for (const recipe of recipes) {
      if (recipe.menuItemId !== line.menuItemId) continue;
      required.set(recipe.ingredientId, (required.get(recipe.ingredientId) ?? 0) + recipe.perPortionMilli * line.quantity);
    }
  }
  return required;
}

// RF-06: no mínimo ou abaixo; negativos primeiro, depois quem está mais longe do mínimo, depois por nome.
export function stockAlerts<T extends { name: string; quantityMilli: number; minimumMilli: number }>(items: T[]): T[] {
  const shortage = (item: T) => item.minimumMilli - item.quantityMilli;
  return items
    .filter((item) => item.quantityMilli <= item.minimumMilli)
    .sort(
      (a, b) =>
        Number(b.quantityMilli < 0) - Number(a.quantityMilli < 0) ||
        shortage(b) - shortage(a) ||
        a.name.localeCompare(b.name, 'pt-BR'),
    );
}
