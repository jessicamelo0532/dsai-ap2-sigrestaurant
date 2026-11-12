import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createMenuItem, createTable, openOrder, prisma, resetDatabase, service } from './support/database';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('mesas', () => {
  it('cria mesa e lista sem comanda aberta', async () => {
    await createTable(3, 6);
    await createTable(1, 2);

    const tables = await service.listTables();

    expect(tables.map((table) => table.number)).toEqual([1, 3]);
    expect(tables[1]).toMatchObject({ number: 3, capacity: 6, order: null });
  });

  it('RN-01: recusa número de mesa repetido', async () => {
    await createTable(1);

    await expect(createTable(1)).rejects.toBeInstanceOf(BadRequestException);
    await expect(createTable(1)).rejects.toThrow('Já existe uma mesa com esse número.');
  });

  it('mostra a comanda aberta junto da mesa', async () => {
    const { order } = await openOrder(5, 2);

    const [table] = await service.listTables();

    expect(table.order?.id).toBe(order.id);
    expect(table.order?.items).toHaveLength(1);
  });

  it('RN-01: não remove mesa com comanda aberta', async () => {
    const { table } = await openOrder(2);

    await expect(service.deleteTable(table.id)).rejects.toThrow('Feche a comanda antes de remover esta mesa.');
    expect(await prisma.diningTable.count()).toBe(1);
  });

  it('remove mesa depois que a conta foi fechada e mantém o histórico da comanda', async () => {
    const { table, order } = await openOrder(2);
    await service.closeOrder(order.id, { paymentMethod: 'PIX' });

    await expect(service.deleteTable(table.id)).resolves.toEqual({ success: true });

    const history = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(history).toMatchObject({ tableId: null, tableNumber: 2, status: 'PAID' });
  });

  it('avisa quando a mesa não existe', async () => {
    await expect(service.deleteTable(999)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deleteTable(999)).rejects.toThrow('Mesa não encontrada.');
  });
});

describe('cardápio', () => {
  it('cria item com categoria padrão "Geral" e preço com duas casas', async () => {
    const item = await service.createMenuItem({ name: 'Suco de cupuaçu', price: 12.9 });

    expect(item.category).toBe('Geral');
    expect(item.price.toFixed(2)).toBe('12.90');
    expect(item.available).toBe(true);
  });

  it('lista por categoria e depois por nome', async () => {
    await createMenuItem({ name: 'Tacacá', category: 'Pratos principais' });
    await createMenuItem({ name: 'Pudim', category: 'Sobremesas' });
    await createMenuItem({ name: 'Maniçoba', category: 'Pratos principais' });
    await createMenuItem({ name: 'Bolinho de piracuí', category: 'Entradas' });

    const menu = await service.listMenu();

    expect(menu.map((item) => item.name)).toEqual(['Bolinho de piracuí', 'Maniçoba', 'Tacacá', 'Pudim']);
  });

  it('RN-02: item pausado some da listagem padrão, mas aparece ao pedir todos', async () => {
    const paused = await createMenuItem({ name: 'Pato no tucupi' });
    await createMenuItem({ name: 'Vatapá' });
    await service.updateMenuItem(paused.id, { available: false });

    const visible = await service.listMenu();
    const all = await service.listMenu(true);

    expect(visible.map((item) => item.name)).toEqual(['Vatapá']);
    expect(all.map((item) => item.name).sort()).toEqual(['Pato no tucupi', 'Vatapá']);
  });

  it('reativa item pausado', async () => {
    const item = await createMenuItem({ available: false });

    await service.updateMenuItem(item.id, { available: true });

    expect(await service.listMenu()).toHaveLength(1);
  });

  it('edita nome e preço sem mexer nos outros campos', async () => {
    const item = await createMenuItem({ name: 'Caldeirada', category: 'Pratos principais', price: 60 });

    const updated = await service.updateMenuItem(item.id, { price: 64.5 });

    expect(updated.price.toFixed(2)).toBe('64.50');
    expect(updated.name).toBe('Caldeirada');
    expect(updated.category).toBe('Pratos principais');
  });

  it('consulta e remove item pelo id', async () => {
    const item = await createMenuItem();

    expect((await service.getMenuItem(item.id)).name).toBe('Açaí com peixe');
    await expect(service.deleteMenuItem(item.id)).resolves.toEqual({ success: true });
    await expect(service.getMenuItem(item.id)).rejects.toThrow('Item do cardápio não encontrado.');
  });

  it('avisa quando o item não existe ao editar ou remover', async () => {
    await expect(service.updateMenuItem(404, { name: 'Novo nome' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deleteMenuItem(404)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remover item do cardápio não apaga o que já foi pedido', async () => {
    const { item, order } = await openOrder(1, 2, 30);

    await service.deleteMenuItem(item.id);

    const line = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(line).toMatchObject({ menuItemId: null, nameSnapshot: 'Prato da mesa 1', quantity: 2 });
  });
});
