import { describe, expect, it } from 'vitest';
import {
  costCents, findIngredientDuplicate, formatMargin, ingredientKey, ingredientName, ingredientUsage,
  INGREDIENT_COST_ERROR, INGREDIENT_IN_USE, INGREDIENT_NAME_ERROR, marginPercent, recipeCostCents,
  recipeView, RECIPE_DUPLICATE, RECIPE_QUANTITY_ERROR, validateCost, validateIngredientName,
  validateQuantity, validateRecipe,
} from './ficha-tecnica';
import type { Ingredient, MenuItem, Recipe } from './types';

const ingredient = (overrides: Partial<Ingredient> = {}): Ingredient => ({
  id: 1, name: 'Queijo', unit: 'KG', cost: '10.00', ...overrides,
});

const menuItem: MenuItem = { id: 7, name: 'Pizza', description: null, category: 'Pratos', price: '40.00', available: true };

describe('ingrediente (RN-01 e RN-02)', () => {
  it('normaliza o nome e compara sem acento e maiúscula', () => {
    expect(ingredientName('  Queijo   mussarela ')).toBe('Queijo mussarela');
    expect(ingredientKey('Açaí')).toBe('acai');
  });

  it('valida nome, unidade e custo', () => {
    expect(validateIngredientName('Queijo')).toBeNull();
    expect(validateIngredientName('a')).toBe(INGREDIENT_NAME_ERROR);
    expect(validateCost('0')).toBeNull();
    expect(validateCost('12.50')).toBeNull();
    expect(validateCost('-1')).toBe(INGREDIENT_COST_ERROR);
    expect(validateCost('1.234')).toBe(INGREDIENT_COST_ERROR);
    expect(validateCost('abc')).toBe(INGREDIENT_COST_ERROR);
  });

  it('encontra duplicado ignorando o próprio id', () => {
    const list = [ingredient({ id: 1, name: 'Queijo mussarela' })];
    expect(findIngredientDuplicate(list, 'queijo MUSSARELA')?.id).toBe(1);
    expect(findIngredientDuplicate(list, 'Queijo mussarela', 1)).toBeNull();
  });

  it('converte o custo para centavos', () => {
    expect(costCents('10.00')).toBe(1000);
    expect(costCents('0.29')).toBe(29);
  });
});

describe('ficha técnica (RN-03 a RN-05)', () => {
  it('exige quantidade positiva com até 3 casas', () => {
    expect(validateQuantity('0.250')).toBeNull();
    expect(validateQuantity('0')).toBe(RECIPE_QUANTITY_ERROR);
    expect(validateQuantity('-1')).toBe(RECIPE_QUANTITY_ERROR);
    expect(validateQuantity('1.2345')).toBe(RECIPE_QUANTITY_ERROR);
  });

  it('recusa ingrediente repetido', () => {
    const list = [ingredient({ id: 1 }), ingredient({ id: 2, name: 'Tomate' })];
    expect(validateRecipe([{ ingredientId: 1, quantity: 1 }, { ingredientId: 1, quantity: 2 }], list)).toBe(RECIPE_DUPLICATE);
  });

  it('calcula o custo como soma de custo × quantidade', () => {
    const list = [ingredient({ id: 1, cost: '2.50' }), ingredient({ id: 2, name: 'Tomate', cost: '10.00' })];
    expect(recipeCostCents([{ ingredientId: 1, quantity: 2 }, { ingredientId: 2, quantity: 0.5 }], list)).toBe(1000);
  });

  it('calcula a margem percentual sobre o preço', () => {
    expect(marginPercent(4000, 1000)).toBe(75);
    expect(marginPercent(4000, 5000)).toBe(-25);
    expect(marginPercent(0, 1000)).toBeNull();
    expect(formatMargin(75)).toBe('75,0%');
    expect(formatMargin(null)).toBe('—');
  });

  it('monta a visão da ficha com custo, preço e margem', () => {
    const list = [ingredient({ id: 1, cost: '10.00' })];
    const recipe: Recipe = { menuItemId: 7, items: [{ ingredientId: 1, quantity: 2 }] };
    const view = recipeView(menuItem, recipe, list);
    expect(view.cost).toBe('20.00');
    expect(view.price).toBe('40.00');
    expect(view.margin).toBe(50);
    expect(view.items[0]).toMatchObject({ name: 'Queijo', unit: 'KG', total: '20.00' });
  });

  it('conta em quantas fichas o ingrediente aparece', () => {
    const recipes: Recipe[] = [
      { menuItemId: 1, items: [{ ingredientId: 1, quantity: 1 }] },
      { menuItemId: 2, items: [{ ingredientId: 1, quantity: 2 }, { ingredientId: 2, quantity: 1 }] },
    ];
    expect(ingredientUsage(recipes, 1)).toBe(2);
    expect(ingredientUsage(recipes, 2)).toBe(1);
    expect(INGREDIENT_IN_USE).toContain('fichas técnicas');
  });
});
