import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CreateIngredientDto, SetRecipeDto, StockLossDto } from '../src/stock/stock.dto';
import { createMenuItem, openOrder, prisma, resetDatabase, service } from './support/database';
import { ingredientWith, quantityOf, stock, stockController } from './support/stock';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

// Prato com ficha: 0,200 kg de filhote e 1 un de açaí por porção.
async function dishWithRecipe(fishKg = 2, acaiUnits = 7) {
  const fish = await ingredientWith('Filhote', fishKg, 'KG');
  const acai = await ingredientWith('Açaí', acaiUnits, 'UN');
  const dish = await createMenuItem({ name: 'Filhote com açaí' });
  await stock.setRecipe(dish.id, {
    items: [
      { ingredientId: fish.id, quantity: 0.2 },
      { ingredientId: acai.id, quantity: 1 },
    ],
  });
  return { fish, acai, dish };
}

describe('RF-07: ficha técnica', () => {
  it('CA-06: mostra os ingredientes em ordem e as porções possíveis', async () => {
    const { dish } = await dishWithRecipe(2, 7);

    const recipe = await stockController.recipe(dish.id);

    expect(recipe.name).toBe('Filhote com açaí');
    expect(recipe.items.map((item) => [item.name, item.unit, item.quantity.toFixed(3), item.inStock.toFixed(3)])).toEqual([
      ['Açaí', 'UN', '1.000', '7.000'],
      ['Filhote', 'KG', '0.200', '2.000'],
    ]);
    expect(recipe.portionsAvailable).toBe(7);
  });

  it('prato sem ficha não tem cálculo de porções', async () => {
    const dish = await createMenuItem();

    const recipe = await stock.getRecipe(dish.id);

    expect(recipe.items).toEqual([]);
    expect(recipe.portionsAvailable).toBeNull();
  });

  it('salvar substitui a ficha inteira, e lista vazia apaga', async () => {
    const { dish, acai } = await dishWithRecipe();

    const replaced = await stockController.setRecipe(dish.id, { items: [{ ingredientId: acai.id, quantity: 2 }] });
    expect(replaced.items.map((item) => item.name)).toEqual(['Açaí']);
    expect(replaced.portionsAvailable).toBe(3);

    const cleared = await stock.setRecipe(dish.id, { items: [] });
    expect(cleared.items).toEqual([]);
    expect(await prisma.recipeItem.count()).toBe(0);
  });

  it('RN-06: recusa ingrediente repetido sem mudar a ficha atual', async () => {
    const { dish, fish } = await dishWithRecipe();

    await expect(
      stock.setRecipe(dish.id, {
        items: [
          { ingredientId: fish.id, quantity: 0.2 },
          { ingredientId: fish.id, quantity: 0.1 },
        ],
      }),
    ).rejects.toThrow('O ingrediente Filhote aparece mais de uma vez na ficha técnica.');
    expect(await prisma.recipeItem.count({ where: { menuItemId: dish.id } })).toBe(2);
  });

  it('recusa ingrediente inexistente, quantidade inválida e prato inexistente', async () => {
    const { dish, fish } = await dishWithRecipe();

    await expect(stock.setRecipe(dish.id, { items: [{ ingredientId: 999, quantity: 1 }] })).rejects.toThrow(
      'Ingrediente 999 não encontrado.',
    );
    await expect(stock.setRecipe(dish.id, { items: [{ ingredientId: fish.id, quantity: 0 }] })).rejects.toThrow(
      'maior que zero',
    );
    await expect(stock.setRecipe(999, { items: [] })).rejects.toThrow('Item do cardápio não encontrado.');
    await expect(stock.getRecipe(999)).rejects.toThrow('Item do cardápio não encontrado.');
  });
});

describe('RF-08: baixa ao fechar a conta', () => {
  it('CA-03: baixa a ficha vezes a quantidade, com movimentação de venda ligada à comanda', async () => {
    const { fish, acai, dish } = await dishWithRecipe(2, 7);
    const { table } = await openOrder(1);
    const order = await service.addOrderItem(table.id, { menuItemId: dish.id, quantity: 2 });

    await service.closeOrder(order!.id, { paymentMethod: 'PIX' });

    expect(await quantityOf(fish.id)).toBe('1.600');
    expect(await quantityOf(acai.id)).toBe('5.000');
    const sales = await prisma.stockMovement.findMany({ where: { type: 'SALE' }, orderBy: { ingredientId: 'asc' } });
    expect(sales.map((movement) => [movement.ingredientId, movement.quantity.toFixed(3), movement.orderId])).toEqual([
      [fish.id, '-0.400', order!.id],
      [acai.id, '-2.000', order!.id],
    ]);
  });

  it('soma o mesmo ingrediente usado em pratos diferentes da comanda', async () => {
    const { acai, dish } = await dishWithRecipe(2, 10);
    const bowl = await createMenuItem({ name: 'Tigela de açaí' });
    await stock.setRecipe(bowl.id, { items: [{ ingredientId: acai.id, quantity: 0.5 }] });
    const { table } = await openOrder(1);
    await service.addOrderItem(table.id, { menuItemId: dish.id, quantity: 1 });
    const order = await service.addOrderItem(table.id, { menuItemId: bowl.id, quantity: 3 });

    await service.closeOrder(order!.id, { paymentMethod: 'CASH' });

    expect(await quantityOf(acai.id)).toBe('7.500');
    expect(await prisma.stockMovement.count({ where: { type: 'SALE', ingredientId: acai.id } })).toBe(1);
  });

  it('CA-04: sem estoque suficiente, a conta fecha, o estoque fica negativo e entra nos alertas', async () => {
    const { fish, dish } = await dishWithRecipe(0.1, 5);
    const { table } = await openOrder(1);
    const order = await service.addOrderItem(table.id, { menuItemId: dish.id, quantity: 1 });

    const paid = await service.closeOrder(order!.id, { paymentMethod: 'DEBIT' });

    expect(paid?.status).toBe('PAID');
    expect(await quantityOf(fish.id)).toBe('-0.100');
    expect((await stock.alerts())[0].name).toBe('Filhote');
  });

  it('RN-08: usa a ficha do momento do fechamento', async () => {
    const { fish, acai, dish } = await dishWithRecipe(2, 7);
    const { table } = await openOrder(1);
    const order = await service.addOrderItem(table.id, { menuItemId: dish.id, quantity: 1 });
    await stock.setRecipe(dish.id, { items: [{ ingredientId: fish.id, quantity: 0.5 }] });

    await service.closeOrder(order!.id, { paymentMethod: 'PIX' });

    expect(await quantityOf(fish.id)).toBe('1.500');
    expect(await quantityOf(acai.id)).toBe('7.000');
  });

  it('CA-05: comanda cancelada e prato sem ficha não mexem no estoque', async () => {
    const { fish, acai, dish } = await dishWithRecipe(2, 7);
    const first = await openOrder(1);
    const cancelled = await service.addOrderItem(first.table.id, { menuItemId: dish.id, quantity: 2 });
    await service.cancelOrder(cancelled!.id);
    const second = await openOrder(2);

    await service.closeOrder(second.order.id, { paymentMethod: 'PIX' });

    expect(await quantityOf(fish.id)).toBe('2.000');
    expect(await quantityOf(acai.id)).toBe('7.000');
    expect(await prisma.stockMovement.count({ where: { type: 'SALE' } })).toBe(0);
  });

  it('se o fechamento falhar, a baixa também é desfeita', async () => {
    const { fish, dish } = await dishWithRecipe(2, 7);
    const { table } = await openOrder(1);
    const order = await service.addOrderItem(table.id, { menuItemId: dish.id, quantity: 1 });
    await service.closeOrder(order!.id, { paymentMethod: 'PIX' });

    await expect(service.closeOrder(order!.id, { paymentMethod: 'PIX' })).rejects.toThrow('Esta comanda já foi fechada.');

    expect(await quantityOf(fish.id)).toBe('1.800');
  });
});

describe('RN-09: remover ingrediente', () => {
  it('não remove ingrediente que está em ficha técnica; sem a ficha, remove', async () => {
    const { fish, dish } = await dishWithRecipe();

    await expect(stock.deleteIngredient(fish.id)).rejects.toThrow('Remova Filhote das fichas técnicas antes de excluir.');

    await service.deleteMenuItem(dish.id);
    await expect(stock.deleteIngredient(fish.id)).resolves.toEqual({ success: true });
  });
});

describe('validação dos dados do estoque', () => {
  async function invalidFields<T extends object>(dto: new () => T, body: Record<string, unknown>) {
    const errors = await validate(plainToInstance(dto, body), { whitelist: true, forbidNonWhitelisted: true });
    return errors.map((error) => error.property).sort();
  }

  it('unidade precisa ser uma das cinco aceitas', async () => {
    expect(await invalidFields(CreateIngredientDto, { name: 'Leite', unit: 'L' })).toEqual([]);
    const errors = await validate(plainToInstance(CreateIngredientDto, { name: 'Leite', unit: 'XICARA' }));
    expect(errors[0].constraints).toEqual({ isIn: 'Unidade inválida. Use UN, KG, G, L, ML.' });
  });

  it('perda exige motivo', async () => {
    expect(await invalidFields(StockLossDto, { quantity: 1, note: 'Venceu' })).toEqual([]);
    expect(await invalidFields(StockLossDto, { quantity: 1 })).toEqual(['note']);
    expect(await invalidFields(StockLossDto, { quantity: 1, note: '  ' })).toEqual(['note']);
  });

  it('ficha técnica valida cada item da lista', async () => {
    expect(await invalidFields(SetRecipeDto, { items: [{ ingredientId: 1, quantity: '0.25' }] })).toEqual([]);
    expect(await invalidFields(SetRecipeDto, { items: [{ ingredientId: 1, quantity: 0.0001 }] })).toEqual(['items']);
    expect(await invalidFields(SetRecipeDto, { items: 'farinha' })).toEqual(['items']);
  });
});
