import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { AddOrderItemDto } from '../src/dto';
import { KitchenService } from '../src/kitchen/kitchen.service';
import { MenuOptionsController } from '../src/menu-options/menu-options.controller';
import { SetMenuOptionsDto } from '../src/menu-options/menu-options.dto';
import { MenuOptionsService } from '../src/menu-options/menu-options.service';
import { SalesReportsService } from '../src/sales-reports/sales-reports.service';
import { createMenuItem, createTable, prisma, resetDatabase, service } from './support/database';

// Variações e adicionais (SPEC/2026-11-16-variacoes-e-adicionais.md).
const options = new MenuOptionsService(prisma);
const controller = new MenuOptionsController(options);

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

const acaiOptions = {
  variants: [{ name: '300 ml', price: 15 }, { name: '500 ml', price: 22.5 }],
  addons: [{ name: 'Leite em pó', price: 3.5 }, { name: 'Granola', price: 2 }, { name: 'Sem açúcar', price: 0 }],
};

async function acaiOnTable() {
  const table = await createTable(1);
  const acai = await createMenuItem({ name: 'Açaí', category: 'Sobremesas', price: 12 });
  const saved = await controller.replace(acai.id, acaiOptions);
  const id = (list: { id: number; name: string }[], name: string) => list.find((option) => option.name === name)!.id;
  return {
    table,
    acai,
    saved,
    v500: id(saved.variants, '500 ml'),
    v300: id(saved.variants, '300 ml'),
    granola: id(saved.addons, 'Granola'),
    milk: id(saved.addons, 'Leite em pó'),
    noSugar: id(saved.addons, 'Sem açúcar'),
  };
}

describe('T-01: o total da linha inclui variação e adicionais (CA-01)', () => {
  it('lança 2 açaís de 500 ml com granola e leite em pó', async () => {
    const { table, acai, saved, v500, granola, milk, noSugar } = await acaiOnTable();
    expect(saved.variants.map((v) => [v.name, v.price])).toEqual([['300 ml', '15.00'], ['500 ml', '22.50']]);
    expect(saved.addons.map((a) => [a.name, a.price])).toEqual([['Granola', '2.00'], ['Leite em pó', '3.50'], ['Sem açúcar', '0.00']]);

    const order = await service.addOrderItem(table.id, { menuItemId: acai.id, quantity: 2, variantId: v500, addonIds: [granola, milk, noSugar] });
    const [line] = order!.items;
    expect(line).toMatchObject({ nameSnapshot: 'Açaí (500 ml)', variantName: '500 ml', quantity: 2 });
    expect(line.unitPrice.toString()).toBe('28');
    expect(line.addons.map((addon) => [addon.nameSnapshot, addon.price.toString()])).toEqual([
      ['Granola', '2'],
      ['Leite em pó', '3.5'],
      ['Sem açúcar', '0'],
    ]);
    expect((await service.getOrder(order!.id)).total).toBe('56.00');

    await service.closeOrder(order!.id, { paymentMethod: 'PIX' });
    const sales = await new SalesReportsService(prisma).report(new Date('2000-01-01'), new Date('2100-01-01'), 10);
    expect(sales.topByRevenue).toEqual([expect.objectContaining({ name: 'Açaí (500 ml)', quantity: 2, revenue: '56.00' })]);
  });
});

describe('T-02: a comanda guarda a escolha (CA-02)', () => {
  it('mudar preço, renomear ou apagar as opções não muda a linha', async () => {
    const { table, acai, v300, granola } = await acaiOnTable();
    const order = await service.addOrderItem(table.id, { menuItemId: acai.id, quantity: 1, variantId: v300, addonIds: [granola] });

    await options.replace(acai.id, { variants: [{ name: 'Pequeno', price: 99 }], addons: [{ name: 'Granola premium', price: 9 }] });
    await service.updateMenuItem(acai.id, { name: 'Açaí da casa', price: 50 });
    let saved = await service.getOrder(order!.id);
    expect(saved.items[0]).toMatchObject({ nameSnapshot: 'Açaí (300 ml)', variantName: '300 ml' });
    expect(saved.items[0].addons.map((addon) => addon.nameSnapshot)).toEqual(['Granola']);
    expect(saved.total).toBe('17.00');

    await options.replace(acai.id, {});
    saved = await service.getOrder(order!.id);
    expect(saved.total).toBe('17.00');
    expect(await controller.get(acai.id)).toEqual({ menuItemId: acai.id, variants: [], addons: [] });
  });
});

describe('T-03: lançamento com e sem opções (CA-03)', () => {
  it('item sem opções é lançado como antes', async () => {
    const table = await createTable(1);
    const water = await createMenuItem({ name: 'Água', price: 4 });
    const order = await service.addOrderItem(table.id, { menuItemId: water.id, quantity: 3 });
    expect(order!.items[0]).toMatchObject({ nameSnapshot: 'Água', variantName: null, quantity: 3, addons: [] });
    expect((await service.getOrder(order!.id)).total).toBe('12.00');
  });

  it('item só com adicionais usa o preço do item', async () => {
    const table = await createTable(1);
    const tapioca = await createMenuItem({ name: 'Tapioca', price: 10 });
    const saved = await options.replace(tapioca.id, { addons: [{ name: 'Queijo', price: 4 }] });
    const order = await service.addOrderItem(table.id, { menuItemId: tapioca.id, quantity: 1, addonIds: [saved.addons[0].id] });
    expect(order!.items[0]).toMatchObject({ nameSnapshot: 'Tapioca', variantName: null });
    expect((await service.getOrder(order!.id)).total).toBe('14.00');
  });

  it('recusa sem variação, com opção de outro item e com adicional repetido, sem abrir comanda', async () => {
    const { table, acai, v300, granola } = await acaiOnTable();
    const other = await createMenuItem({ name: 'Tapioca', price: 10 });
    const otherOptions = await options.replace(other.id, { variants: [{ name: 'Grande', price: 14 }], addons: [{ name: 'Queijo', price: 4 }] });

    await expect(service.addOrderItem(table.id, { menuItemId: acai.id, quantity: 1 })).rejects.toThrow('Escolha a variação de Açaí: 300 ml, 500 ml.');
    await expect(
      service.addOrderItem(table.id, { menuItemId: acai.id, quantity: 1, variantId: otherOptions.variants[0].id }),
    ).rejects.toThrow('Variação não encontrada para este item.');
    await expect(
      service.addOrderItem(table.id, { menuItemId: acai.id, quantity: 1, variantId: v300, addonIds: [otherOptions.addons[0].id] }),
    ).rejects.toThrow('Adicional não encontrado para este item.');
    await expect(
      service.addOrderItem(table.id, { menuItemId: acai.id, quantity: 1, variantId: v300, addonIds: [granola, granola] }),
    ).rejects.toThrow('O adicional Granola foi escolhido duas vezes.');
    expect(await prisma.order.count()).toBe(0);
  });
});

describe('T-04: listas inválidas não apagam as opções (CA-04)', () => {
  it('recusa e mantém o que existia', async () => {
    const { acai } = await acaiOnTable();
    await expect(options.replace(acai.id, { variants: [{ name: 'Único', price: 0 }] })).rejects.toThrow('Informe um preço válido para Único.');
    await expect(options.replace(acai.id, { addons: [{ name: 'Mel', price: 1 }, { name: 'MEL', price: 2 }] })).rejects.toThrow(
      'A opção MEL está repetida.',
    );
    await expect(options.replace(999, acaiOptions)).rejects.toThrow(NotFoundException);
    await expect(options.get(999)).rejects.toThrow('Item do cardápio não encontrado.');

    const kept = await options.get(acai.id);
    expect(kept.variants).toHaveLength(2);
    expect(kept.addons).toHaveLength(3);
  });

  it('apagar o item apaga as opções, mas não as linhas já lançadas', async () => {
    const { table, acai, v500, granola } = await acaiOnTable();
    const order = await service.addOrderItem(table.id, { menuItemId: acai.id, quantity: 1, variantId: v500, addonIds: [granola] });
    await service.cancelOrder(order!.id);
    await service.deleteMenuItem(acai.id);
    expect(await prisma.menuVariant.count()).toBe(0);
    expect(await prisma.menuAddon.count()).toBe(0);
    expect(await prisma.orderItemAddon.count()).toBe(1);
  });
});

describe('T-05: a cozinha vê os adicionais (CA-05)', () => {
  it('mostra os adicionais em cada linha do pedido', async () => {
    const { table, acai, v500, granola, milk } = await acaiOnTable();
    const order = await service.addOrderItem(table.id, { menuItemId: acai.id, quantity: 1, variantId: v500, addonIds: [milk, granola] });
    const ticket = await new KitchenService(prisma).send(order!.id);
    expect(ticket.items).toEqual([{ id: order!.items[0].id, name: 'Açaí (500 ml)', quantity: 1, addons: ['Leite em pó', 'Granola'] }]);
  });
});

describe('validação das rotas', () => {
  it('confere as listas e a escolha no lançamento', async () => {
    expect(await validate(plainToInstance(SetMenuOptionsDto, acaiOptions))).toEqual([]);
    expect(await validate(plainToInstance(SetMenuOptionsDto, {}))).toEqual([]);
    expect((await validate(plainToInstance(SetMenuOptionsDto, { variants: 'P' }))).map((e) => e.property)).toEqual(['variants']);

    expect(await validate(plainToInstance(AddOrderItemDto, { menuItemId: 1, quantity: 1, variantId: '2', addonIds: [3, 4] }))).toEqual([]);
    const bad = await validate(plainToInstance(AddOrderItemDto, { menuItemId: 1, quantity: 1, variantId: 0, addonIds: ['x'] }));
    expect(bad.map((e) => e.property).sort()).toEqual(['addonIds', 'variantId']);
  });
});
