import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { KitchenController } from '../src/kitchen/kitchen.controller';
import { KitchenPriorityDto, SendToKitchenDto } from '../src/kitchen/kitchen.dto';
import { KitchenService } from '../src/kitchen/kitchen.service';
import { OrderMovesService } from '../src/order-moves/order-moves.service';
import { createMenuItem, createTable, openOrder, prisma, resetDatabase, service } from './support/database';

// Envio para a cozinha e fila de produção (SPEC/2026-11-16-cozinha-kds.md).
// Relógio controlado: o serviço começa às 12h (UTC) de 16/11.
const clock = { now: new Date('2026-11-16T12:00:00.000Z') };
const kitchen = new KitchenService(prisma, () => clock.now);
const controller = new KitchenController(kitchen);
const moves = new OrderMovesService(prisma);
const at = (hhmm: string) => { clock.now = new Date(`2026-11-16T${hhmm}:00.000Z`); };

beforeEach(async () => {
  await resetDatabase();
  at('12:00');
});
afterAll(() => prisma.$disconnect());

// Comanda com dois pratos na mesa indicada.
async function orderWithTwoItems(tableNumber: number) {
  const { table, order } = await openOrder(tableNumber, 2, 30);
  const drink = await createMenuItem({ name: `Suco da mesa ${tableNumber}`, category: 'Bebidas', price: 9 });
  const withDrink = await service.addOrderItem(table.id, { menuItemId: drink.id, quantity: 1 });
  // Ordena pelo id: dois itens criados no mesmo milissegundo empatam no horário.
  const items = [...withDrink!.items].sort((a, b) => a.id - b.id);
  return { table, order: { ...withDrink!, items }, drink };
}

describe('T-01: envio e fila (CA-01)', () => {
  it('a cozinha vê o pedido enviado, com mesa, itens e observação', async () => {
    const { order } = await orderWithTwoItems(3);
    await prisma.order.update({ where: { id: order.id }, data: { waiterName: 'Rita' } });

    const ticket = await controller.send(order.id, { note: '  sem cebola ' });
    expect(ticket).toMatchObject({
      orderId: order.id,
      tableNumber: 3,
      waiterName: 'Rita',
      status: 'QUEUED',
      priority: 'NORMAL',
      note: 'sem cebola',
      waitingMinutes: 0,
      band: 'NO_PRAZO',
    });
    expect(ticket.items).toEqual([
      { id: order.items[0].id, name: 'Prato da mesa 3', quantity: 2 },
      { id: order.items[1].id, name: 'Suco da mesa 3', quantity: 1 },
    ]);

    const queue = await controller.queue();
    expect(queue.tickets.map((t) => t.id)).toEqual([ticket.id]);
    expect(queue.summary).toEqual({
      total: 1,
      byStatus: { QUEUED: 1, PREPARING: 0, READY: 0 },
      byBand: { NO_PRAZO: 1, ATENCAO: 0, ATRASADO: 0 },
      highPriority: 0,
    });
    expect(queue.generatedAt).toEqual(new Date('2026-11-16T12:00:00.000Z'));
  });

  it('a fila vem na ordem de chegada', async () => {
    const first = await orderWithTwoItems(1);
    const second = await orderWithTwoItems(2);
    at('12:01');
    const late = await kitchen.send(second.order.id);
    at('12:02');
    const later = await kitchen.send(first.order.id);
    expect((await kitchen.queue()).tickets.map((t) => t.id)).toEqual([late.id, later.id]);
  });

  it('sem observação, o pedido fica sem nota', async () => {
    const { order } = await orderWithTwoItems(4);
    expect((await kitchen.send(order.id)).note).toBeNull();
  });

  it('recusa comanda inexistente, fechada ou sem itens novos (RN-01 e RN-02)', async () => {
    await expect(kitchen.send(999)).rejects.toThrow(NotFoundException);

    const { order } = await orderWithTwoItems(5);
    await kitchen.send(order.id);
    await expect(kitchen.send(order.id)).rejects.toThrow('Não há itens novos para enviar à cozinha.');

    await service.closeOrder(order.id, { paymentMethod: 'PIX' });
    await expect(kitchen.send(order.id)).rejects.toThrow('Só comandas abertas podem enviar pedidos para a cozinha.');
    expect(await prisma.kitchenTicket.count()).toBe(1);
  });

  it('recusa observação longa antes de abrir a transação', async () => {
    const { order } = await orderWithTwoItems(6);
    await expect(kitchen.send(order.id, { note: 'x'.repeat(201) })).rejects.toThrow('A observação deve ter até 200 caracteres.');
    expect(await prisma.kitchenTicket.count()).toBe(0);
  });

  it('dois envios simultâneos não mandam o mesmo item duas vezes (RNF-01)', async () => {
    const { order } = await orderWithTwoItems(7);
    const results = await Promise.allSettled([kitchen.send(order.id), kitchen.send(order.id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason.message).toBe('Não há itens novos para enviar à cozinha.');
    expect(await prisma.kitchenTicket.count()).toBe(1);
  });
});

describe('T-02: item enviado fica travado (CA-02)', () => {
  it('recusa alterar ou remover item enviado e deixa o novo item editável', async () => {
    const { table, order, drink } = await orderWithTwoItems(8);
    const first = await kitchen.send(order.id);
    const sentItem = order.items[0];

    await expect(service.updateOrderItem(order.id, sentItem.id, { quantity: 5 })).rejects.toThrow(
      'Este item já foi enviado para a cozinha e não pode ser alterado.',
    );
    await expect(service.removeOrderItem(order.id, sentItem.id)).rejects.toThrow(
      'Este item já foi enviado para a cozinha e não pode ser alterado.',
    );
    expect((await prisma.orderItem.findUniqueOrThrow({ where: { id: sentItem.id } })).quantity).toBe(2);

    const withDessert = await service.addOrderItem(table.id, { menuItemId: drink.id, quantity: 1 });
    const newItem = withDessert!.items.find((item) => !order.items.some((old) => old.id === item.id))!;
    await service.updateOrderItem(order.id, newItem.id, { quantity: 3 });
    expect((await kitchen.listForOrder(order.id)).pendingItems).toBe(1);

    at('12:05');
    const second = await kitchen.send(order.id);
    expect(second.items).toEqual([{ id: newItem.id, name: 'Suco da mesa 8', quantity: 3 }]);

    const listed = await controller.listForOrder(order.id);
    expect(listed.pendingItems).toBe(0);
    expect(listed.tickets.map((t) => t.id)).toEqual([first.id, second.id]);
    await expect(kitchen.listForOrder(999)).rejects.toThrow(NotFoundException);
  });
});

describe('T-03: tempo de espera e faixas (CA-03)', () => {
  it('mostra os minutos e a faixa nos limites e para quando fica pronto', async () => {
    const { order } = await orderWithTwoItems(9);
    const ticket = await kitchen.send(order.id);
    const band = async () => {
      const [entry] = (await kitchen.queue()).tickets;
      return [entry.waitingMinutes, entry.band];
    };

    at('12:09');
    expect(await band()).toEqual([9, 'NO_PRAZO']);
    at('12:10');
    expect(await band()).toEqual([10, 'ATENCAO']);
    at('12:19');
    expect(await band()).toEqual([19, 'ATENCAO']);
    at('12:20');
    expect(await band()).toEqual([20, 'ATRASADO']);
    expect((await kitchen.queue()).summary.byBand.ATRASADO).toBe(1);

    await controller.ready(ticket.id);
    at('12:45');
    expect(await band()).toEqual([20, 'ATRASADO']);
    expect((await kitchen.queue()).summary.byBand).toEqual({ NO_PRAZO: 0, ATENCAO: 0, ATRASADO: 0 });
  });
});

describe('T-04: prioridade (CA-04)', () => {
  it('pedido com prioridade alta vai para o topo e o histórico mostra quem mudou', async () => {
    const ids: number[] = [];
    for (const [table, time] of [[1, '12:00'], [2, '12:03'], [3, '12:06']] as const) {
      const { order } = await orderWithTwoItems(table);
      at(time);
      ids.push((await kitchen.send(order.id)).id);
    }
    expect((await kitchen.queue()).tickets.map((t) => t.id)).toEqual(ids);

    at('12:07');
    const changed = await controller.priority(ids[2], { priority: 'HIGH', changedBy: ' Chef Lia ' });
    expect(changed.priority).toBe('HIGH');
    expect(changed.priorityChanges).toEqual([
      { from: 'NORMAL', to: 'HIGH', changedBy: 'Chef Lia', changedAt: new Date('2026-11-16T12:07:00.000Z') },
    ]);
    const queue = await kitchen.queue();
    expect(queue.tickets.map((t) => t.id)).toEqual([ids[2], ids[0], ids[1]]);
    expect(queue.summary.highPriority).toBe(1);

    at('12:08');
    const back = await kitchen.setPriority(ids[2], { priority: 'NORMAL', changedBy: 'Rita' });
    expect(back.priorityChanges.map((c) => [c.from, c.to, c.changedBy])).toEqual([
      ['NORMAL', 'HIGH', 'Chef Lia'],
      ['HIGH', 'NORMAL', 'Rita'],
    ]);
    expect((await kitchen.queue()).tickets.map((t) => t.id)).toEqual(ids);
  });

  it('recusa prioridade repetida, inválida, sem autor ou de pedido entregue (RN-07)', async () => {
    const { order } = await orderWithTwoItems(4);
    const ticket = await kitchen.send(order.id);

    await expect(kitchen.setPriority(ticket.id, { priority: 'NORMAL', changedBy: 'Rita' })).rejects.toThrow(
      'O pedido já está com essa prioridade.',
    );
    await expect(kitchen.setPriority(ticket.id, { priority: 'URGENTE', changedBy: 'Rita' })).rejects.toThrow(
      'Informe a prioridade: NORMAL ou HIGH.',
    );
    await expect(kitchen.setPriority(ticket.id, { priority: 'HIGH', changedBy: ' ' })).rejects.toThrow(
      'Informe quem mudou a prioridade, de 2 a 80 caracteres.',
    );
    await expect(kitchen.setPriority(999, { priority: 'HIGH', changedBy: 'Rita' })).rejects.toThrow(NotFoundException);

    await kitchen.advance(ticket.id, 'ready');
    await kitchen.advance(ticket.id, 'deliver');
    await expect(kitchen.setPriority(ticket.id, { priority: 'HIGH', changedBy: 'Rita' })).rejects.toThrow(
      'Só pedidos na fila podem mudar de prioridade.',
    );
    expect(await prisma.kitchenPriorityChange.count()).toBe(0);
  });
});

describe('T-05: situações do pedido (CA-05)', () => {
  it('passa por em preparo, pronto e entregue, guardando cada hora, e sai da fila', async () => {
    const { order } = await orderWithTwoItems(5);
    const ticket = await kitchen.send(order.id);

    at('12:02');
    expect(await controller.start(ticket.id)).toMatchObject({ status: 'PREPARING', startedAt: new Date('2026-11-16T12:02:00.000Z') });
    at('12:11');
    expect(await controller.ready(ticket.id)).toMatchObject({ status: 'READY', readyAt: new Date('2026-11-16T12:11:00.000Z'), waitingMinutes: 11 });
    expect((await kitchen.queue()).summary.byStatus).toEqual({ QUEUED: 0, PREPARING: 0, READY: 1 });
    at('12:13');
    expect(await controller.deliver(ticket.id)).toMatchObject({ status: 'DELIVERED', deliveredAt: new Date('2026-11-16T12:13:00.000Z') });

    expect((await kitchen.queue()).tickets).toEqual([]);
    const detail = await controller.get(ticket.id);
    expect(detail).toMatchObject({ status: 'DELIVERED', waitingMinutes: 11, priorityChanges: [] });
  });

  it('recusa transições fora de ordem sem mudar nada (RN-06)', async () => {
    const { order } = await orderWithTwoItems(6);
    const ticket = await kitchen.send(order.id);

    await expect(kitchen.advance(ticket.id, 'deliver')).rejects.toThrow('Este pedido está aguardando e não pode ser entregue.');
    await kitchen.advance(ticket.id, 'start');
    await expect(kitchen.advance(ticket.id, 'start')).rejects.toThrow('Este pedido está em preparo e não pode começar o preparo.');
    await kitchen.advance(ticket.id, 'ready');
    await kitchen.advance(ticket.id, 'deliver');
    await expect(kitchen.advance(ticket.id, 'ready')).rejects.toThrow('Este pedido está entregue e não pode ficar pronto.');
    await expect(kitchen.advance(999, 'start')).rejects.toThrow('Pedido de cozinha não encontrado.');
    await expect(kitchen.get(999)).rejects.toThrow('Pedido de cozinha não encontrado.');
    expect((await prisma.kitchenTicket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe('DELIVERED');
  });
});

describe('T-06: cancelar, juntar e transferir (CA-06)', () => {
  it('cancelar a comanda tira da fila os pedidos não entregues (RN-08)', async () => {
    const { table, order, drink } = await orderWithTwoItems(1);
    const delivered = await kitchen.send(order.id);
    await kitchen.advance(delivered.id, 'ready');
    await kitchen.advance(delivered.id, 'deliver');
    await service.addOrderItem(table.id, { menuItemId: drink.id, quantity: 1 });
    const pending = await kitchen.send(order.id);
    const other = await orderWithTwoItems(2);
    const untouched = await kitchen.send(other.order.id);

    await service.cancelOrder(order.id);

    const rows = await prisma.kitchenTicket.findMany({ orderBy: { id: 'asc' } });
    expect(rows.map((t) => [t.id, t.status])).toEqual([
      [delivered.id, 'DELIVERED'],
      [pending.id, 'CANCELLED'],
      [untouched.id, 'QUEUED'],
    ]);
    expect(rows[1].cancelledAt).not.toBeNull();
    expect((await kitchen.queue()).tickets.map((t) => t.id)).toEqual([untouched.id]);
  });

  it('juntar comandas leva os pedidos da origem para o destino (RN-09)', async () => {
    const target = await orderWithTwoItems(1);
    const source = await orderWithTwoItems(2);
    const sourceTicket = await kitchen.send(source.order.id);

    await moves.merge(target.order.id, { sourceOrderId: source.order.id, reason: 'Mesmo grupo' });

    const [entry] = (await kitchen.queue()).tickets;
    expect(entry).toMatchObject({ id: sourceTicket.id, orderId: target.order.id, tableNumber: 1 });
    expect((await kitchen.listForOrder(target.order.id)).pendingItems).toBe(2);
    expect((await kitchen.listForOrder(source.order.id)).tickets).toEqual([]);
  });

  it('transferir a comanda muda a mesa na fila (RN-10)', async () => {
    const { order } = await orderWithTwoItems(1);
    const ticket = await kitchen.send(order.id);
    const free = await createTable(12);

    await moves.transfer(order.id, { tableId: free.id, reason: 'Cliente pediu janela' });

    expect((await kitchen.get(ticket.id)).tableNumber).toBe(12);
  });
});

describe('validação das rotas', () => {
  it('confere prioridade e autor no corpo', async () => {
    const ok = plainToInstance(KitchenPriorityDto, { priority: 'HIGH', changedBy: ' Lia ' });
    expect(await validate(ok)).toEqual([]);
    expect(ok.changedBy).toBe('Lia');
    const bad = await validate(plainToInstance(KitchenPriorityDto, { priority: 'ALTA', changedBy: 'L' }));
    expect(bad.map((e) => e.property).sort()).toEqual(['changedBy', 'priority']);
  });

  it('observação é opcional e limitada a 200 caracteres', async () => {
    expect(await validate(plainToInstance(SendToKitchenDto, {}))).toEqual([]);
    const bad = await validate(plainToInstance(SendToKitchenDto, { note: 'x'.repeat(201) }));
    expect(bad.map((e) => e.property)).toEqual(['note']);
  });
});
