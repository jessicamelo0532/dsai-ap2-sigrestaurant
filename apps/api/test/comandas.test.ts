import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createMenuItem, createTable, openOrder, prisma, resetDatabase, service } from './support/database';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('adicionar itens à comanda', () => {
  it('RN-03: o primeiro item abre a comanda da mesa', async () => {
    const table = await createTable(7);
    const item = await createMenuItem({ price: 20 });

    const order = await service.addOrderItem(table.id, { menuItemId: item.id, quantity: 3 });

    expect(order).toMatchObject({ tableId: table.id, tableNumber: 7, status: 'OPEN' });
    expect(order?.items).toHaveLength(1);
    expect(order?.items[0]).toMatchObject({ menuItemId: item.id, quantity: 3 });
  });

  it('itens seguintes entram na mesma comanda, na ordem do pedido', async () => {
    const { table, order } = await openOrder(1);
    const drink = await createMenuItem({ name: 'Guaraná', price: 7 });

    const updated = await service.addOrderItem(table.id, { menuItemId: drink.id, quantity: 2 });

    expect(updated?.id).toBe(order.id);
    expect(updated?.items.map((line) => line.nameSnapshot)).toEqual(['Prato da mesa 1', 'Guaraná']);
    expect(await prisma.order.count()).toBe(1);
  });

  it('RN-03: recusa item pausado', async () => {
    const table = await createTable(1);
    const paused = await createMenuItem({ available: false });

    await expect(service.addOrderItem(table.id, { menuItemId: paused.id, quantity: 1 })).rejects.toThrow(
      'Este item não está disponível no cardápio.',
    );
    expect(await prisma.order.count()).toBe(0);
  });

  it('recusa item que não existe e mesa que não existe', async () => {
    const table = await createTable(1);
    const item = await createMenuItem();

    await expect(service.addOrderItem(table.id, { menuItemId: 999, quantity: 1 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.addOrderItem(999, { menuItemId: item.id, quantity: 1 })).rejects.toThrow(
      'Mesa não encontrada.',
    );
  });

  it('RN-04: a comanda guarda nome e preço do momento do pedido', async () => {
    const { item, order } = await openOrder(1, 1, 30);

    await service.updateMenuItem(item.id, { name: 'Nome novo', price: 99 });

    const saved = await service.getOrder(order.id);
    expect(saved.items[0].nameSnapshot).toBe('Prato da mesa 1');
    expect(saved.items[0].unitPrice.toFixed(2)).toBe('30.00');
    expect(saved.total).toBe('30.00');
  });

  it('depois de paga, um novo pedido na mesma mesa abre outra comanda', async () => {
    const { table, item, order } = await openOrder(4);
    await service.closeOrder(order.id, { paymentMethod: 'CASH' });

    const next = await service.addOrderItem(table.id, { menuItemId: item.id, quantity: 1 });

    expect(next?.id).not.toBe(order.id);
    expect(next?.status).toBe('OPEN');
  });
});

describe('alterar e remover itens', () => {
  it('altera a quantidade e recalcula o total', async () => {
    const { order } = await openOrder(1, 1, 12.5);
    const lineId = order.items[0].id;

    await service.updateOrderItem(order.id, lineId, { quantity: 4 });

    expect((await service.getOrder(order.id)).total).toBe('50.00');
  });

  it('avisa quando o item não pertence à comanda', async () => {
    const first = await openOrder(1);
    const second = await openOrder(2);

    await expect(
      service.updateOrderItem(first.order.id, second.order.items[0].id, { quantity: 2 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.removeOrderItem(first.order.id, second.order.items[0].id)).rejects.toThrow(
      'Item da comanda não encontrado.',
    );
  });

  it('RN-05: remover o último item apaga a comanda', async () => {
    const { order } = await openOrder(1);

    await service.removeOrderItem(order.id, order.items[0].id);

    await expect(service.getOrder(order.id)).rejects.toThrow('Comanda não encontrada.');
  });

  it('remover um item que não é o último mantém a comanda', async () => {
    const { table, order } = await openOrder(1, 1, 10);
    const dessert = await createMenuItem({ name: 'Doce de bacuri', price: 15 });
    await service.addOrderItem(table.id, { menuItemId: dessert.id, quantity: 1 });

    await service.removeOrderItem(order.id, order.items[0].id);

    const saved = await service.getOrder(order.id);
    expect(saved.items.map((line) => line.nameSnapshot)).toEqual(['Doce de bacuri']);
    expect(saved.total).toBe('15.00');
  });

  it('RN-06: não altera nem remove itens de comanda já paga', async () => {
    const { order } = await openOrder(1);
    const lineId = order.items[0].id;
    await service.closeOrder(order.id, { paymentMethod: 'DEBIT' });

    await expect(service.updateOrderItem(order.id, lineId, { quantity: 2 })).rejects.toThrow(
      'A comanda não está aberta.',
    );
    await expect(service.removeOrderItem(order.id, lineId)).rejects.toThrow('A comanda não está aberta.');
  });
});

describe('fechar e cancelar comandas', () => {
  it('fecha a conta registrando forma de pagamento e horário', async () => {
    const { order } = await openOrder(1);
    const before = Date.now();

    const paid = await service.closeOrder(order.id, { paymentMethod: 'PIX' });

    expect(paid).toMatchObject({ status: 'PAID', paymentMethod: 'PIX' });
    expect(paid?.paidAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it('RN-06: não fecha a mesma conta duas vezes', async () => {
    const { order } = await openOrder(1);
    await service.closeOrder(order.id, { paymentMethod: 'PIX' });

    await expect(service.closeOrder(order.id, { paymentMethod: 'CASH' })).rejects.toThrow(
      'Esta comanda já foi fechada.',
    );
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.paymentMethod).toBe('PIX');
  });

  it('RN-06: não fecha comanda sem itens', async () => {
    const table = await createTable(1);
    const empty = await prisma.order.create({ data: { tableId: table.id, tableNumber: 1 } });

    await expect(service.closeOrder(empty.id, { paymentMethod: 'PIX' })).rejects.toThrow(
      'Adicione pelo menos um item antes de fechar a conta.',
    );
  });

  it('cancela comanda aberta e libera a mesa', async () => {
    const { table, order } = await openOrder(1);

    const cancelled = await service.cancelOrder(order.id);

    expect(cancelled.status).toBe('CANCELLED');
    expect(await service.listOpenOrders()).toHaveLength(0);
    await expect(service.deleteTable(table.id)).resolves.toEqual({ success: true });
  });

  it('RN-06: não cancela comanda já paga', async () => {
    const { order } = await openOrder(1);
    await service.closeOrder(order.id, { paymentMethod: 'CREDIT' });

    await expect(service.cancelOrder(order.id)).rejects.toThrow('Apenas comandas abertas podem ser canceladas.');
  });

  it('avisa quando a comanda não existe', async () => {
    await expect(service.closeOrder(999, { paymentMethod: 'PIX' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.cancelOrder(999)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getOrder(999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lista só as comandas abertas, da mais antiga para a mais nova', async () => {
    const first = await openOrder(1);
    const second = await openOrder(2);
    const third = await openOrder(3);
    await service.closeOrder(second.order.id, { paymentMethod: 'PIX' });

    const open = await service.listOpenOrders();

    expect(open.map((order) => order.id)).toEqual([first.order.id, third.order.id]);
  });
});
