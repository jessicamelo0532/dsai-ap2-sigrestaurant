import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MergeOrderDto, TransferOrderDto } from '../src/order-moves/order-moves.dto';
import { OrderMovesController } from '../src/order-moves/order-moves.controller';
import { OrderMovesService } from '../src/order-moves/order-moves.service';
import { WaitersService } from '../src/waiters/waiters.service';
import { controller, createMenuItem, createTable, openOrder, prisma, resetDatabase, service } from './support/database';

const moves = new OrderMovesService(prisma);
const movesController = new OrderMovesController(moves);

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const total = (order: { items: { unitPrice: { toString(): string }; quantity: number }[] }) =>
  order.items.reduce((sum, line) => sum + Math.round(Number(line.unitPrice.toString()) * 100) * line.quantity, 0);

describe('RF-01: transferir comanda de mesa', () => {
  it('CA-01: mantém itens e total, libera a mesa antiga e ocupa a nova', async () => {
    const { table: from, order } = await openOrder(1, 2, 30);
    const to = await createTable(7);

    const moved = await movesController.transfer(order.id, { tableId: to.id, reason: '  Cliente pediu janela  ' });

    expect(moved).toMatchObject({ id: order.id, tableId: to.id, tableNumber: 7, status: 'OPEN' });
    expect(moved.items.map((line) => line.id)).toEqual(order.items.map((line) => line.id));
    expect(total(moved)).toBe(6000);
    const tables = await service.listTables();
    expect(tables.find((table) => table.id === from.id)?.order).toBeNull();
    expect(tables.find((table) => table.id === to.id)?.order?.id).toBe(order.id);
  });

  it('CA-04: recusa mesma mesa, mesa ocupada, mesa inexistente e comanda paga, sem mudar nada', async () => {
    const { table, order } = await openOrder(1);
    const { table: busy } = await openOrder(2);

    await expect(moves.transfer(order.id, { tableId: table.id, reason: 'Teste' })).rejects.toThrow('A comanda já está nessa mesa.');
    await expect(moves.transfer(order.id, { tableId: busy.id, reason: 'Teste' })).rejects.toThrow(
      'A mesa 2 já tem uma comanda aberta. Junte as contas em vez de transferir.',
    );
    await expect(moves.transfer(order.id, { tableId: 999, reason: 'Teste' })).rejects.toThrow('Mesa não encontrada.');
    await expect(moves.transfer(999, { tableId: table.id, reason: 'Teste' })).rejects.toThrow('Comanda não encontrada.');
    await service.closeOrder(order.id, { paymentMethod: 'PIX' });
    const free = await createTable(9);
    await expect(moves.transfer(order.id, { tableId: free.id, reason: 'Teste' })).rejects.toThrow('Só comandas abertas podem mudar de mesa.');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).tableNumber).toBe(1);
    expect(await prisma.orderEvent.count()).toBe(0);
  });

  it('RN-06: motivo obrigatório', async () => {
    const { order } = await openOrder(1);
    const free = await createTable(2);

    await expect(moves.transfer(order.id, { tableId: free.id, reason: 'ok' })).rejects.toThrow('Informe o motivo, de 3 a 200 caracteres.');
  });
});

describe('RF-02: juntar contas', () => {
  it('CA-02: o destino fica com os itens das duas, a origem fica MERGED e só o destino é pago', async () => {
    const { order: target } = await openOrder(1, 2, 30);
    const { table: sourceTable, order: source } = await openOrder(2, 1, 45.5);
    const drink = await createMenuItem({ name: 'Guaraná', price: 7 });
    await service.addOrderItem(sourceTable.id, { menuItemId: drink.id, quantity: 3 });
    await service.updateMenuItem(drink.id, { price: 99 });

    const merged = await movesController.merge(target.id, { sourceOrderId: source.id, reason: 'Grupos juntaram as mesas' });

    expect(merged.items.map((line) => line.nameSnapshot)).toEqual(['Prato da mesa 1', 'Prato da mesa 2', 'Guaraná']);
    expect(merged.items.find((line) => line.nameSnapshot === 'Guaraná')?.unitPrice.toFixed(2)).toBe('7.00');
    expect(total(merged)).toBe(6000 + 4550 + 2100);
    const origin = await prisma.order.findUniqueOrThrow({ where: { id: source.id }, include: { items: true } });
    expect(origin).toMatchObject({ status: 'MERGED', mergedIntoId: target.id, items: [] });
    expect((await service.listTables()).find((table) => table.id === sourceTable.id)?.order).toBeNull();

    await expect(service.closeOrder(source.id, { paymentMethod: 'PIX' })).rejects.toThrow('Esta comanda já foi fechada.');
    await expect(service.cancelOrder(source.id)).rejects.toThrow('Apenas comandas abertas podem ser canceladas.');
    const paid = await service.closeOrder(target.id, { paymentMethod: 'CASH' });
    const today = paid!.paidAt!.toISOString().slice(0, 10);
    expect(await controller.report(today, today)).toMatchObject({ paidOrders: 1, revenue: '126.50' });
  });

  it('RN-05: o garçom do destino é mantido', async () => {
    const waiters = new WaitersService(prisma);
    const ana = await waiters.create({ name: 'Ana' });
    const bruno = await waiters.create({ name: 'Bruno' });
    const { order: target } = await openOrder(1);
    const { order: source } = await openOrder(2);
    await waiters.assign(target.id, { waiterId: ana.id });
    await waiters.assign(source.id, { waiterId: bruno.id });

    await moves.merge(target.id, { sourceOrderId: source.id, reason: 'Mesma família' });

    expect((await prisma.order.findUniqueOrThrow({ where: { id: target.id } })).waiterName).toBe('Ana');
  });

  it('CA-04: recusa a mesma comanda, comanda paga ou inexistente, sem mexer nos itens', async () => {
    const { order: target } = await openOrder(1);
    const { order: source } = await openOrder(2);

    await expect(moves.merge(target.id, { sourceOrderId: target.id, reason: 'Teste' })).rejects.toThrow('Escolha duas comandas diferentes.');
    await expect(moves.merge(target.id, { sourceOrderId: 999, reason: 'Teste' })).rejects.toThrow('Comanda não encontrada.');
    await service.closeOrder(source.id, { paymentMethod: 'PIX' });
    await expect(moves.merge(target.id, { sourceOrderId: source.id, reason: 'Teste' })).rejects.toThrow('Só comandas abertas podem ser juntadas.');
    await expect(moves.merge(source.id, { sourceOrderId: target.id, reason: 'Teste' })).rejects.toThrow('Só comandas abertas podem ser juntadas.');
    expect(await prisma.orderItem.count({ where: { orderId: source.id } })).toBe(1);
    expect(await prisma.orderEvent.count()).toBe(0);
  });
});

describe('RF-03 e RN-07: histórico', () => {
  it('CA-03: transferência e junção ficam registradas com motivo, nas duas comandas', async () => {
    const { order: target } = await openOrder(1);
    const { order: source } = await openOrder(2);
    const free = await createTable(5);
    await moves.transfer(target.id, { tableId: free.id, reason: 'Ar-condicionado' });
    await moves.merge(target.id, { sourceOrderId: source.id, reason: 'Juntaram as mesas' });

    const history = await movesController.history(target.id);
    const originHistory = await moves.history(source.id);

    expect(history.map((event) => [event.type, event.fromTableNumber, event.toTableNumber, event.sourceOrderId, event.reason])).toEqual([
      ['TRANSFER', 1, 5, null, 'Ar-condicionado'],
      ['MERGE', 2, 5, source.id, 'Juntaram as mesas'],
    ]);
    expect(originHistory.map((event) => event.type)).toEqual(['MERGE']);
    await expect(moves.history(999)).rejects.toThrow('Comanda não encontrada.');
  });
});

describe('validação dos dados de entrada', () => {
  async function invalidFields<T extends object>(dto: new () => T, body: Record<string, unknown>) {
    const errors = await validate(plainToInstance(dto, body), { whitelist: true, forbidNonWhitelisted: true });
    return errors.map((error) => error.property).sort();
  }

  it('transferência e junção exigem destino e motivo', async () => {
    expect(await invalidFields(TransferOrderDto, { tableId: 2, reason: 'Janela' })).toEqual([]);
    expect(await invalidFields(TransferOrderDto, { tableId: 0, reason: 'ok' })).toEqual(['reason', 'tableId']);
    expect(await invalidFields(MergeOrderDto, { sourceOrderId: 3, reason: 'Juntar' })).toEqual([]);
    expect(await invalidFields(MergeOrderDto, { reason: 'Juntar' })).toEqual(['sourceOrderId']);
  });
});
