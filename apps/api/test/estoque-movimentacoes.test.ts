import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma, resetDatabase } from './support/database';
import { ingredientWith, quantityOf, stock, stockController } from './support/stock';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('RF-01 e RN-01: cadastro de ingredientes', () => {
  it('cria com quantidade zero, mínimo padrão zero e nome sem espaços sobrando', async () => {
    const ingredient = await stockController.create({ name: '  Farinha d’água  ', unit: 'KG' });

    expect(ingredient).toMatchObject({ name: 'Farinha d’água', unit: 'KG' });
    expect(ingredient.quantity.toFixed(3)).toBe('0.000');
    expect(ingredient.minimumQuantity.toFixed(3)).toBe('0.000');
  });

  it('recusa nome repetido mesmo com maiúsculas diferentes', async () => {
    await ingredientWith('Tucupi');

    await expect(stock.createIngredient({ name: 'TUCUPI', unit: 'L' })).rejects.toThrow(
      'Já existe um ingrediente chamado Tucupi.',
    );
  });

  it('recusa mínimo negativo ou com mais de 3 casas', async () => {
    await expect(stock.createIngredient({ name: 'Jambu', unit: 'UN', minimumQuantity: -1 })).rejects.toThrow(
      'Informe o estoque mínimo, zero ou mais, com até 3 casas decimais.',
    );
    await expect(stock.createIngredient({ name: 'Jambu', unit: 'UN', minimumQuantity: 0.0005 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('lista em ordem alfabética', async () => {
    await ingredientWith('Tucupi');
    await ingredientWith('Alho');
    await ingredientWith('Jambu');

    const names = (await stockController.list()).map((ingredient) => ingredient.name);

    expect(names).toEqual(['Alho', 'Jambu', 'Tucupi']);
  });

  it('edita nome, unidade e mínimo; pode manter o próprio nome', async () => {
    const ingredient = await ingredientWith('Camarão seco', 0, 'KG');
    await ingredientWith('Pimenta');

    const updated = await stockController.update(ingredient.id, { name: 'Camarão seco', unit: 'G', minimumQuantity: 500 });

    expect(updated).toMatchObject({ name: 'Camarão seco', unit: 'G' });
    expect(updated.minimumQuantity.toFixed(3)).toBe('500.000');
    await expect(stock.updateIngredient(ingredient.id, { name: 'pimenta' })).rejects.toThrow(
      'Já existe um ingrediente chamado Pimenta.',
    );
  });

  it('remove ingrediente que não está em ficha técnica, junto com o histórico', async () => {
    const ingredient = await ingredientWith('Coentro', 2, 'UN');

    await expect(stockController.remove(ingredient.id)).resolves.toEqual({ success: true });
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  it('avisa quando o ingrediente não existe', async () => {
    await expect(stockController.get(404)).rejects.toThrow('Ingrediente não encontrado.');
    await expect(stock.updateIngredient(404, { unit: 'G' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(stock.deleteIngredient(404)).rejects.toBeInstanceOf(NotFoundException);
    await expect(stock.registerEntry(404, { quantity: 1 })).rejects.toBeInstanceOf(NotFoundException);
    await expect(stock.listMovements(404)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RF-02 a RF-05: movimentações', () => {
  it('CA-01: entrada, perda e contagem resultam na soma das movimentações', async () => {
    const fish = await ingredientWith('Filhote');

    await stockController.entry(fish.id, { quantity: 5, note: 'Feira do Ver-o-Peso' });
    await stockController.loss(fish.id, { quantity: 1.5, note: 'Estragou na geladeira' });
    const counted = await stockController.count(fish.id, { countedQuantity: 3 });

    expect(counted.ingredient.quantity.toFixed(3)).toBe('3.000');
    const history = await stockController.movements(fish.id);
    expect(history.map((movement) => [movement.type, movement.quantity.toFixed(3), movement.note])).toEqual([
      ['ADJUSTMENT', '-0.500', null],
      ['LOSS', '-1.500', 'Estragou na geladeira'],
      ['PURCHASE', '5.000', 'Feira do Ver-o-Peso'],
    ]);
    const sum = history.reduce((total, movement) => total + Number(movement.quantity), 0);
    expect(sum).toBeCloseTo(3, 3);
  });

  it('contagem acima do estoque gera ajuste positivo', async () => {
    const acai = await ingredientWith('Açaí', 2, 'L');

    const result = await stock.registerCount(acai.id, { countedQuantity: 2.75, note: 'Contagem de sexta' });

    expect(result.movement?.quantity.toFixed(3)).toBe('0.750');
    expect(result.movement?.type).toBe('ADJUSTMENT');
  });

  it('RN-04: contagem igual ao estoque não grava movimentação', async () => {
    const acai = await ingredientWith('Açaí', 2, 'L');

    const result = await stock.registerCount(acai.id, { countedQuantity: 2 });

    expect(result.movement).toBeNull();
    expect(await prisma.stockMovement.count({ where: { ingredientId: acai.id } })).toBe(1);
  });

  it('CA-02: perda maior que o estoque é recusada e nada muda', async () => {
    const fish = await ingredientWith('Filhote', 1);

    await expect(stock.registerLoss(fish.id, { quantity: 2, note: 'Queda' })).rejects.toThrow(
      'Estoque insuficiente: há 1,000 kg de Filhote.',
    );
    expect(await quantityOf(fish.id)).toBe('1.000');
    expect(await prisma.stockMovement.count({ where: { type: 'LOSS' } })).toBe(0);
  });

  it('RN-02: recusa entrada zero, negativa ou com mais de 3 casas', async () => {
    const salt = await ingredientWith('Sal');

    for (const quantity of [0, -1, 1.2345]) {
      await expect(stock.registerEntry(salt.id, { quantity })).rejects.toThrow(
        'Informe uma quantidade maior que zero com até 3 casas decimais.',
      );
    }
    expect(await quantityOf(salt.id)).toBe('0.000');
  });

  it('recusa contagem negativa', async () => {
    const salt = await ingredientWith('Sal', 1);

    await expect(stock.registerCount(salt.id, { countedQuantity: -0.5 })).rejects.toThrow(
      'Informe a quantidade contada, zero ou mais, com até 3 casas decimais.',
    );
  });

  it('soma de decimais pequenos não perde precisão', async () => {
    const pepper = await ingredientWith('Pimenta-de-cheiro', 0, 'KG');

    for (let index = 0; index < 10; index += 1) await stock.registerEntry(pepper.id, { quantity: 0.1 });

    expect(await quantityOf(pepper.id)).toBe('1.000');
  });
});

describe('CA-08 e RF-06: alertas', () => {
  it('lista só quem está no mínimo ou abaixo, na ordem combinada', async () => {
    await ingredientWith('Açaí', 5, 'L', 2);
    await ingredientWith('Farinha', 1, 'KG', 3);
    await ingredientWith('Tucupi', 2, 'L', 2);
    await ingredientWith('Camarão', 0, 'KG', 4);
    const jambu = await ingredientWith('Jambu', 1, 'UN', 0);
    await prisma.ingredient.update({ where: { id: jambu.id }, data: { quantity: '-2.000' } });

    const alerts = await stockController.alerts();

    expect(alerts.map((ingredient) => ingredient.name)).toEqual(['Jambu', 'Camarão', 'Farinha', 'Tucupi']);
    expect(alerts[0]).not.toHaveProperty('quantityMilli');
  });

  it('sem nada abaixo do mínimo, a lista vem vazia', async () => {
    await ingredientWith('Açaí', 5, 'L', 2);

    expect(await stock.alerts()).toEqual([]);
  });
});
