// Ficha técnica e margem no cardápio (SPEC/2026-11-19-ficha-tecnica-e-margem.md).
// Funções puras: a tela só desenha; o local-store persiste as mesmas regras.

import type { Ingredient, IngredientUnit, MenuItem, Recipe, RecipeLine, RecipeView } from './types';

export const INGREDIENT_UNITS: IngredientUnit[] = ['UN', 'KG', 'G', 'L', 'ML'];
export const UNIT_LABELS: Record<IngredientUnit, string> = {
  UN: 'unidade', KG: 'quilo', G: 'grama', L: 'litro', ML: 'mililitro',
};

export const INGREDIENT_NAME_ERROR = 'Informe o nome do ingrediente, de 2 a 80 caracteres.';
export const INGREDIENT_COST_ERROR = 'Informe um custo maior ou igual a zero, com até 2 casas decimais.';
export const INGREDIENT_UNIT_ERROR = 'Selecione uma unidade válida.';
export const INGREDIENT_DUPLICATE = 'Já existe um ingrediente com esse nome.';
export const INGREDIENT_IN_USE = 'Remova o ingrediente das fichas técnicas antes de excluir.';
export const RECIPE_QUANTITY_ERROR = 'Informe uma quantidade maior que zero, com até 3 casas decimais.';
export const RECIPE_DUPLICATE = 'O ingrediente já está na ficha técnica.';
export const RECIPE_INGREDIENT_ERROR = 'Escolha um ingrediente da lista.';

export function ingredientName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function ingredientKey(value: string): string {
  return ingredientName(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function validateIngredientName(value: string): string | null {
  const name = ingredientName(value);
  return name.length < 2 || name.length > 80 ? INGREDIENT_NAME_ERROR : null;
}

export function validateUnit(value: string): string | null {
  return INGREDIENT_UNITS.includes(value as IngredientUnit) ? null : INGREDIENT_UNIT_ERROR;
}

// RN-02: custo em reais, zero ou mais, com até duas casas.
export function validateCost(value: string | number): string | null {
  const text = String(value).trim().replace(',', '.');
  if (!text) return INGREDIENT_COST_ERROR;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return INGREDIENT_COST_ERROR;
  return Number(text) < 0 ? INGREDIENT_COST_ERROR : null;
}

export function costCents(value: string | number): number {
  return Math.round(Number(String(value).replace(',', '.')) * 100);
}

export function moneyDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

// RN-03: quantidade positiva com até três casas.
export function validateQuantity(value: string | number): string | null {
  const text = String(value).trim().replace(',', '.');
  if (!text || !/^\d+(\.\d{1,3})?$/.test(text)) return RECIPE_QUANTITY_ERROR;
  return Number(text) <= 0 ? RECIPE_QUANTITY_ERROR : null;
}

export function findIngredientDuplicate(ingredients: readonly Ingredient[], value: string, exceptId?: number): Ingredient | null {
  const key = ingredientKey(value);
  return ingredients.find((ingredient) => ingredient.id !== exceptId && ingredientKey(ingredient.name) === key) ?? null;
}

export function sortIngredients(ingredients: readonly Ingredient[]): Ingredient[] {
  return [...ingredients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id - b.id);
}

// RN-04: ficha sem ingrediente repetido e com quantidades válidas.
export function validateRecipe(items: readonly RecipeLine[], ingredients: readonly Ingredient[]): string | null {
  const seen = new Set<number>();
  for (const item of items) {
    if (!ingredients.some((ingredient) => ingredient.id === item.ingredientId)) return RECIPE_INGREDIENT_ERROR;
    if (seen.has(item.ingredientId)) return RECIPE_DUPLICATE;
    seen.add(item.ingredientId);
    const invalid = validateQuantity(item.quantity);
    if (invalid) return invalid;
  }
  return null;
}

// RN-05: custo = soma de custo × quantidade, em centavos.
export function recipeCostCents(items: readonly RecipeLine[], ingredients: readonly Ingredient[]): number {
  return items.reduce((total, item) => {
    const ingredient = ingredients.find((entry) => entry.id === item.ingredientId);
    if (!ingredient) return total;
    return total + Math.round(costCents(ingredient.cost) * item.quantity);
  }, 0);
}

// RN-05: margem percentual sobre o preço, uma casa decimal.
export function marginPercent(priceCents: number, costCentsValue: number): number | null {
  if (priceCents <= 0) return null;
  return Math.round(((priceCents - costCentsValue) / priceCents) * 1000) / 10;
}

export function formatMargin(margin: number | null): string {
  if (margin === null) return '—';
  return `${margin.toFixed(1).replace('.', ',')}%`;
}

export function ingredientUsage(recipes: readonly Recipe[], ingredientId: number): number {
  return recipes.filter((recipe) => recipe.items.some((item) => item.ingredientId === ingredientId)).length;
}

export function recipeView(menuItem: MenuItem, recipe: Recipe | undefined, ingredients: readonly Ingredient[]): RecipeView {
  const items = recipe?.items ?? [];
  const cost = recipeCostCents(items, ingredients);
  const price = costCents(menuItem.price);
  return {
    menuItemId: menuItem.id,
    items: items.map((item) => {
      const ingredient = ingredients.find((entry) => entry.id === item.ingredientId);
      const unitCost = ingredient ? costCents(ingredient.cost) : 0;
      return {
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        name: ingredient?.name ?? 'Ingrediente removido',
        unit: ingredient?.unit ?? 'UN',
        cost: ingredient?.cost ?? '0.00',
        total: moneyDecimal(Math.round(unitCost * item.quantity)),
      };
    }),
    cost: moneyDecimal(cost),
    price: menuItem.price,
    margin: marginPercent(price, cost),
  };
}

export function unitLabel(unit: IngredientUnit): string {
  return UNIT_LABELS[unit] ?? unit;
}
