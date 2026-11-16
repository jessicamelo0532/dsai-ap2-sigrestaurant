import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MenuCategoriesController } from '../src/menu-categories/menu-categories.controller';
import {
  AssignMenuCategoryDto,
  CreateMenuCategoryDto,
  ReorderMenuCategoriesDto,
  UpdateMenuCategoryDto,
} from '../src/menu-categories/menu-categories.dto';
import { MenuCategoriesService } from '../src/menu-categories/menu-categories.service';
import { createMenuItem, prisma, resetDatabase, service } from './support/database';

// Categorias do cardápio com ordem de exibição (SPEC/2026-11-16-categorias-do-cardapio.md).
const categories = new MenuCategoriesService(prisma);
const controller = new MenuCategoriesController(categories);

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

const names = async () => (await service.listMenu()).map((item) => item.name);

describe('T-01: o cardápio segue a ordem do cadastro (CA-01)', () => {
  it('lista na ordem das categorias e muda quando a ordem muda', async () => {
    const drinks = await controller.create({ name: 'Bebidas' });
    const starters = await categories.create({ name: 'Entradas' });
    const mains = await categories.create({ name: 'Pratos principais' });
    expect([drinks.sortOrder, starters.sortOrder, mains.sortOrder]).toEqual([0, 1, 2]);

    await createMenuItem({ name: 'Suco de cupuaçu', category: 'Bebidas' });
    await createMenuItem({ name: 'Água', category: 'bebidas' });
    await createMenuItem({ name: 'Bolinho de piracuí', category: 'Entradas' });
    await createMenuItem({ name: 'Maniçoba', category: 'Pratos principais' });
    await createMenuItem({ name: 'Pudim', category: 'Doces da casa' });

    expect(await names()).toEqual(['Água', 'Suco de cupuaçu', 'Bolinho de piracuí', 'Maniçoba', 'Pudim']);

    const reordered = await controller.reorder({ ids: [starters.id, mains.id, drinks.id] });
    expect(reordered.map((category) => [category.name, category.sortOrder])).toEqual([
      ['Entradas', 0],
      ['Pratos principais', 1],
      ['Bebidas', 2],
    ]);
    expect(await names()).toEqual(['Bolinho de piracuí', 'Maniçoba', 'Água', 'Suco de cupuaçu', 'Pudim']);
    expect((await service.listMenu(true)).map((item) => item.name)).toEqual(await names());
  });
});

describe('T-02: categorias na ordem com a contagem de itens (CA-02)', () => {
  it('mostra quantos itens cada categoria tem', async () => {
    await categories.create({ name: 'Bebidas' });
    await categories.create({ name: 'Sobremesas' });
    await createMenuItem({ name: 'Água', category: 'Bebidas' });
    await createMenuItem({ name: 'Suco', category: 'Bebidas' });

    expect((await controller.list()).map((c) => [c.name, c.itemCount])).toEqual([
      ['Bebidas', 2],
      ['Sobremesas', 0],
    ]);
  });
});

describe('T-03: o texto liga o item à categoria (CA-03)', () => {
  it('cria e edita itens pelo texto, sem diferenciar maiúsculas e acentos', async () => {
    const drinks = await categories.create({ name: 'Bebidas' });
    const desserts = await categories.create({ name: 'Sobremesas' });

    const juice = await service.createMenuItem({ name: 'Suco', category: 'bébidas', price: 9 });
    expect(juice).toMatchObject({ categoryId: drinks.id, category: 'Bebidas' });

    const loose = await service.createMenuItem({ name: 'Tapioca', category: 'Lanches', price: 12 });
    expect(loose).toMatchObject({ categoryId: null, category: 'Lanches' });

    const general = await service.createMenuItem({ name: 'Pão', price: 2 });
    expect(general).toMatchObject({ categoryId: null, category: 'Geral' });

    expect(await service.updateMenuItem(juice.id, { category: 'SOBREMESAS' })).toMatchObject({ categoryId: desserts.id, category: 'Sobremesas' });
    expect(await service.updateMenuItem(juice.id, { category: 'Outros' })).toMatchObject({ categoryId: null, category: 'Outros' });
    expect(await service.updateMenuItem(loose.id, { price: 13 })).toMatchObject({ categoryId: null, category: 'Lanches' });
  });

  it('liga e desliga item pela rota própria (RN-06)', async () => {
    const drinks = await categories.create({ name: 'Bebidas' });
    const item = await createMenuItem({ name: 'Água', category: 'Avulsos' });

    expect(await controller.assignItem(item.id, { categoryId: drinks.id })).toMatchObject({ categoryId: drinks.id, category: 'Bebidas' });
    expect(await categories.assignItem(item.id, { categoryId: null })).toMatchObject({ categoryId: null, category: 'Bebidas' });
    await expect(categories.assignItem(item.id, { categoryId: 999 })).rejects.toThrow('Categoria não encontrada.');
    await expect(categories.assignItem(999, { categoryId: drinks.id })).rejects.toThrow('Item do cardápio não encontrado.');
  });
});

describe('T-04: renomear, apagar e reordenar (CA-04)', () => {
  it('renomear muda o texto dos itens ligados', async () => {
    const drinks = await categories.create({ name: 'Bebidas' });
    const water = await createMenuItem({ name: 'Água', category: 'Bebidas' });
    const other = await createMenuItem({ name: 'Pão', category: 'Padaria' });

    expect(await controller.update(drinks.id, { name: '  Bebidas   geladas ' })).toMatchObject({ name: 'Bebidas geladas', nameKey: 'bebidas geladas' });
    expect(await service.getMenuItem(water.id)).toMatchObject({ category: 'Bebidas geladas', categoryId: drinks.id });
    expect(await service.getMenuItem(other.id)).toMatchObject({ category: 'Padaria', categoryId: null });
    expect(await categories.update(drinks.id, {})).toMatchObject({ name: 'Bebidas geladas' });
  });

  it('recusa nome repetido, inválido e categoria inexistente', async () => {
    const drinks = await categories.create({ name: 'Bebidas' });
    await categories.create({ name: 'Entradas' });

    await expect(categories.create({ name: 'BEBÍDAS' })).rejects.toThrow(new ConflictException('Já existe uma categoria com esse nome.'));
    await expect(categories.update(drinks.id, { name: 'entradas' })).rejects.toThrow('Já existe uma categoria com esse nome.');
    await expect(categories.create({ name: 'B' })).rejects.toThrow('Informe o nome da categoria, de 2 a 50 caracteres.');
    await expect(categories.update(999, { name: 'Outra' })).rejects.toThrow(NotFoundException);
    await expect(categories.remove(999)).rejects.toThrow('Categoria não encontrada.');
    expect(await prisma.menuCategory.count()).toBe(2);
  });

  it('não apaga categoria com itens e apaga a vazia', async () => {
    const drinks = await categories.create({ name: 'Bebidas' });
    const empty = await categories.create({ name: 'Vazia' });
    await createMenuItem({ name: 'Água', category: 'Bebidas' });

    await expect(controller.remove(drinks.id)).rejects.toThrow('Esta categoria tem 1 item. Mova os itens antes de apagá-la.');
    await createMenuItem({ name: 'Suco', category: 'Bebidas' });
    await expect(categories.remove(drinks.id)).rejects.toThrow('Esta categoria tem 2 itens. Mova os itens antes de apagá-la.');
    expect(await categories.remove(empty.id)).toEqual({ success: true });
    expect((await categories.list()).map((c) => c.name)).toEqual(['Bebidas']);
  });

  it('nova categoria entra no fim mesmo depois de apagar outra', async () => {
    const first = await categories.create({ name: 'Primeira' });
    const second = await categories.create({ name: 'Segunda' });
    await categories.remove(first.id);
    expect((await categories.create({ name: 'Terceira' })).sortOrder).toBe(second.sortOrder + 1);
  });

  it('reordenar com lista incompleta, repetida ou desconhecida é recusado sem mudar nada', async () => {
    const a = await categories.create({ name: 'Aa' });
    const b = await categories.create({ name: 'Bb' });
    for (const ids of [[a.id], [a.id, a.id], [a.id, 999], [b.id, a.id, 999]]) {
      await expect(categories.reorder({ ids })).rejects.toThrow('Informe todas as categorias, uma vez cada, na nova ordem.');
    }
    expect((await categories.list()).map((c) => c.id)).toEqual([a.id, b.id]);
  });
});

describe('T-05: importação dos textos (CA-05)', () => {
  it('cria uma categoria por texto, sem duplicar, e liga os itens', async () => {
    const drinks = await categories.create({ name: 'Bebidas' });
    const juice = await createMenuItem({ name: 'Suco', category: 'Avulsos' });
    await prisma.menuItem.update({ where: { id: juice.id }, data: { category: 'bebidas' } });
    await createMenuItem({ name: 'Tacacá', category: 'Pratos' });
    await createMenuItem({ name: 'Maniçoba', category: 'pratos' });
    await createMenuItem({ name: 'Pudim', category: 'Sobremesas' });

    const result = await controller.importFromItems();
    expect(result).toEqual({ created: ['Pratos', 'Sobremesas'], linkedItems: 4 });

    expect((await categories.list()).map((c) => [c.name, c.sortOrder, c.itemCount])).toEqual([
      ['Bebidas', 0, 1],
      ['Pratos', 1, 2],
      ['Sobremesas', 2, 1],
    ]);
    expect(await service.getMenuItem(juice.id)).toMatchObject({ categoryId: drinks.id, category: 'Bebidas' });
    expect(await names()).toEqual(['Suco', 'Maniçoba', 'Tacacá', 'Pudim']);

    expect(await categories.importFromItems()).toEqual({ created: [], linkedItems: 0 });
  });
});

describe('validação das rotas', () => {
  it('confere os corpos', async () => {
    expect(await validate(plainToInstance(CreateMenuCategoryDto, { name: ' Bebidas ' }))).toEqual([]);
    expect((await validate(plainToInstance(CreateMenuCategoryDto, { name: 'B' }))).map((e) => e.property)).toEqual(['name']);
    expect(await validate(plainToInstance(UpdateMenuCategoryDto, {}))).toEqual([]);
    expect(await validate(plainToInstance(ReorderMenuCategoriesDto, { ids: [3, 1, 2] }))).toEqual([]);
    expect((await validate(plainToInstance(ReorderMenuCategoriesDto, { ids: ['a'] }))).map((e) => e.property)).toEqual(['ids']);
    expect(await validate(plainToInstance(AssignMenuCategoryDto, { categoryId: null }))).toEqual([]);
    expect((await validate(plainToInstance(AssignMenuCategoryDto, { categoryId: 0 }))).map((e) => e.property)).toEqual(['categoryId']);
  });
});
