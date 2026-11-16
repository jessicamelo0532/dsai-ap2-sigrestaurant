import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CashService } from '../src/cash/cash.service';
import { CustomersService } from '../src/customers/customers.service';
import { DeliveryController } from '../src/delivery/delivery.controller';
import { CreateDeliveryDto, UpdateDeliveryDto } from '../src/delivery/delivery.dto';
import { DeliveryService } from '../src/delivery/delivery.service';
import { KitchenService } from '../src/kitchen/kitchen.service';
import { OrderMovesService } from '../src/order-moves/order-moves.service';
import { SalesReportsService } from '../src/sales-reports/sales-reports.service';
import { createMenuItem, createTable, openOrder, prisma, resetDatabase, service } from './support/database';

// Pedidos de delivery (SPEC/2026-11-16-delivery.md). Nomes, endereços e telefones são fictícios.
const clock = { now: new Date('2026-11-16T15:00:00.000Z') };
const delivery = new DeliveryService(prisma, () => clock.now);
const controller = new DeliveryController(delivery);
const kitchen = new KitchenService(prisma);
const moves = new OrderMovesService(prisma);
const start = new Date('2000-01-01T00:00:00.000Z');
const end = new Date('2100-01-01T00:00:00.000Z');

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

const address = { recipient: ' Ana  Teste ', address: 'Travessa Fictícia, 100 ', phone: '(91) 90000-0001', fee: 7.5 };

async function deliveryWithItems() {
  const order = await controller.create(address);
  const tacaca = await createMenuItem({ name: 'Tacacá', price: 20 });
  const juice = await createMenuItem({ name: 'Suco', category: 'Bebidas', price: 8 });
  await controller.addItem(order.id, { menuItemId: tacaca.id, quantity: 2 });
  return controller.addItem(order.id, { menuItemId: juice.id, quantity: 1 });
}

describe('T-01: o total inclui a taxa (CA-01)', () => {
  it('abre, lança itens, soma a taxa e paga o total com a taxa', async () => {
    const opened = await controller.create(address);
    expect(opened).toMatchObject({
      channel: 'DELIVERY', tableId: null, tableNumber: 0, status: 'OPEN', deliveryStatus: 'RECEIVED',
      recipient: 'Ana Teste', deliveryAddress: 'Travessa Fictícia, 100', deliveryPhone: '91900000001',
      subtotal: '0.00', deliveryFee: '7.50', total: '7.50',
    });

    const order = await deliveryWithItems();
    expect(order).toMatchObject({ subtotal: '48.00', discount: '0.00', deliveryFee: '7.50', total: '55.50' });
    expect(order.items.map((item) => [item.nameSnapshot, item.quantity])).toEqual([['Tacacá', 2], ['Suco', 1]]);

    const cash = new CashService(prisma, () => start);
    await cash.open({ operator: 'Caixa Teste', openingAmount: 0 });
    await service.closeOrder(order.id, { paymentMethod: 'PIX' });
    expect(await service.getOrder(order.id)).toMatchObject({ status: 'PAID', deliveryFee: '7.50', total: '55.50' });
    expect((await new CashService(prisma, () => end).current())?.sales.PIX).toBe('55.50');
  });

  it('liga cliente do cadastro e recusa cliente inexistente ou desativado', async () => {
    const customers = new CustomersService(prisma);
    const ana = await customers.create({ name: 'Ana Teste' });
    const off = await customers.create({ name: 'Sem Uso' });
    await customers.update(off.id, { active: false });

    expect((await delivery.create({ ...address, customerId: ana.id })).customerId).toBe(ana.id);
    await expect(delivery.create({ ...address, customerId: 999 })).rejects.toThrow('Cliente não encontrado.');
    await expect(delivery.create({ ...address, customerId: off.id })).rejects.toThrow('Este cliente está desativado.');
  });

  it('recusa dados inválidos sem abrir pedido', async () => {
    await expect(delivery.create({ ...address, recipient: 'A' })).rejects.toThrow('Informe o nome de quem recebe, de 2 a 80 caracteres.');
    await expect(delivery.create({ ...address, address: 'Rua' })).rejects.toThrow('Informe o endereço de entrega, de 5 a 200 caracteres.');
    await expect(delivery.create({ ...address, phone: '123' })).rejects.toThrow('Informe o telefone com DDD, com 10 ou 11 dígitos.');
    await expect(delivery.create({ ...address, fee: 100.01 })).rejects.toThrow('Informe a taxa de entrega de R$ 0,00 a R$ 100,00.');
    expect(await prisma.order.count()).toBe(0);
  });

  it('lançar item segue as regras do cardápio e só em pedido aberto', async () => {
    const order = await controller.create(address);
    const paused = await createMenuItem({ name: 'Pausado', price: 5, available: false });
    await expect(delivery.addItem(order.id, { menuItemId: paused.id, quantity: 1 })).rejects.toThrow('Este item não está disponível no cardápio.');
    await expect(delivery.addItem(999, { menuItemId: paused.id, quantity: 1 })).rejects.toThrow('Pedido de delivery não encontrado.');
    await service.cancelOrder(order.id);
    const water = await createMenuItem({ name: 'Água', price: 4 });
    await expect(delivery.addItem(order.id, { menuItemId: water.id, quantity: 1 })).rejects.toThrow('Só pedidos abertos recebem itens.');
  });
});

describe('T-02: relatórios separam salão e delivery (CA-02)', () => {
  it('mostra a receita por canal, as taxas e a receita líquida', async () => {
    const order = await deliveryWithItems();
    await service.closeOrder(order.id, { paymentMethod: 'PIX' });
    const { order: dineIn } = await openOrder(1, 1, 100);
    await service.closeOrder(dineIn.id, { paymentMethod: 'CASH' });

    expect(await service.report(start, end)).toMatchObject({
      paidOrders: 2,
      revenue: '155.50',
      byChannel: { DINE_IN: '100.00', DELIVERY: '55.50', deliveryFees: '7.50' },
    });
    expect(await new SalesReportsService(prisma).report(start, end, 10)).toMatchObject({
      revenue: '148.00',
      discounts: '0.00',
      deliveryFees: '7.50',
      netRevenue: '155.50',
    });
  });
});

describe('T-03: a cozinha vê o canal e filtra (CA-03)', () => {
  it('separa os pedidos de delivery na fila', async () => {
    const order = await deliveryWithItems();
    const { order: dineIn } = await openOrder(4, 1, 30);
    const fromDelivery = await kitchen.send(order.id);
    const fromTable = await kitchen.send(dineIn.id);

    expect(fromDelivery).toMatchObject({ channel: 'DELIVERY', tableNumber: 0 });
    expect((await kitchen.queue()).tickets.map((t) => t.id)).toEqual([fromDelivery.id, fromTable.id]);
    expect((await kitchen.queue('DELIVERY')).tickets.map((t) => t.id)).toEqual([fromDelivery.id]);
    expect((await kitchen.queue('DINE_IN')).tickets.map((t) => [t.id, t.channel])).toEqual([[fromTable.id, 'DINE_IN']]);
    await expect(kitchen.queue('balcão')).rejects.toThrow('Informe o canal: DINE_IN ou DELIVERY.');
  });
});

describe('T-04: acompanhamento da entrega (CA-04)', () => {
  it('sai e é entregue, guardando as horas, e não muda depois de sair', async () => {
    const order = await deliveryWithItems();
    expect(await controller.update(order.id, { address: 'Avenida Teste, 200', fee: 5 })).toMatchObject({
      deliveryAddress: 'Avenida Teste, 200', deliveryFee: '5.00', total: '53.00',
    });
    expect(await delivery.update(order.id, { phone: null })).toMatchObject({ deliveryPhone: null, recipient: 'Ana Teste' });

    clock.now = new Date('2026-11-16T15:20:00.000Z');
    expect(await controller.dispatch(order.id)).toMatchObject({ deliveryStatus: 'OUT_FOR_DELIVERY', dispatchedAt: clock.now });
    await expect(delivery.update(order.id, { fee: 0 })).rejects.toThrow('O pedido já saiu para entrega e não pode mudar.');
    await expect(delivery.advance(order.id, 'dispatch')).rejects.toThrow('Este pedido está saiu para entrega e não pode sair para entrega.');

    clock.now = new Date('2026-11-16T15:45:00.000Z');
    expect(await controller.delivered(order.id)).toMatchObject({ deliveryStatus: 'DELIVERED', deliveredAt: clock.now });
    await expect(delivery.advance(order.id, 'deliver')).rejects.toThrow('Este pedido está entregue e não pode ser entregue.');
  });

  it('pedido pago ou cancelado não muda; cancelado também não sai', async () => {
    const paid = await deliveryWithItems();
    await service.closeOrder(paid.id, { paymentMethod: 'PIX' });
    await expect(delivery.update(paid.id, { fee: 0 })).rejects.toThrow('Este pedido já foi pago e não pode mudar.');
    expect((await delivery.advance(paid.id, 'dispatch')).deliveryStatus).toBe('OUT_FOR_DELIVERY');

    const cancelled = await delivery.create(address);
    await service.cancelOrder(cancelled.id);
    await expect(delivery.update(cancelled.id, { fee: 0 })).rejects.toThrow('Este pedido está cancelado e não pode mudar.');
    await expect(delivery.advance(cancelled.id, 'dispatch')).rejects.toThrow('Este pedido está cancelado e não pode sair para entrega.');
  });

  it('lista os ativos por padrão e filtra por situação', async () => {
    const received = await delivery.create(address);
    const out = await delivery.create(address);
    await delivery.advance(out.id, 'dispatch');
    const done = await delivery.create(address);
    await delivery.advance(done.id, 'dispatch');
    await delivery.advance(done.id, 'deliver');
    const cancelled = await delivery.create(address);
    await service.cancelOrder(cancelled.id);

    expect((await controller.list()).map((o) => o.id)).toEqual([received.id, out.id]);
    expect((await delivery.list('DELIVERED')).map((o) => o.id)).toEqual([done.id]);
    expect((await delivery.list('CANCELLED')).map((o) => o.id)).toEqual([cancelled.id]);
    expect((await delivery.list('RECEIVED')).map((o) => o.id)).toEqual([received.id]);
    await expect(delivery.list('ENTREGUE')).rejects.toThrow('Informe a situação: RECEIVED, OUT_FOR_DELIVERY, DELIVERED ou CANCELLED.');
  });
});

describe('T-05: fora do salão (CA-05)', () => {
  it('não aparece nas abertas do salão nem nas mesas, e não é transferido nem juntado', async () => {
    const order = await deliveryWithItems();
    const { table, order: dineIn } = await openOrder(1, 1, 10);
    const free = await createTable(2);

    expect((await service.listOpenOrders()).map((o) => o.id)).toEqual([dineIn.id]);
    expect((await service.listTables()).find((t) => t.id === table.id)?.order?.id).toBe(dineIn.id);
    await expect(service.getOrder(order.id)).resolves.toMatchObject({ channel: 'DELIVERY' });
    await expect(delivery.get(dineIn.id)).rejects.toThrow('Pedido de delivery não encontrado.');

    await expect(moves.transfer(order.id, { tableId: free.id, reason: 'Cliente veio buscar' })).rejects.toThrow(
      'Pedidos de delivery não mudam de mesa nem são juntados.',
    );
    await expect(moves.merge(dineIn.id, { sourceOrderId: order.id, reason: 'Mesmo grupo' })).rejects.toThrow(
      'Pedidos de delivery não mudam de mesa nem são juntados.',
    );
    await expect(moves.merge(order.id, { sourceOrderId: dineIn.id, reason: 'Mesmo grupo' })).rejects.toThrow(
      'Pedidos de delivery não mudam de mesa nem são juntados.',
    );
  });
});

describe('validação das rotas', () => {
  it('confere os corpos', async () => {
    expect(await validate(plainToInstance(CreateDeliveryDto, address))).toEqual([]);
    const bad = await validate(plainToInstance(CreateDeliveryDto, { recipient: 'A', address: 'R', fee: 101 }));
    expect(bad.map((e) => e.property).sort()).toEqual(['address', 'fee', 'recipient']);
    expect(await validate(plainToInstance(UpdateDeliveryDto, {}))).toEqual([]);
    expect((await validate(plainToInstance(UpdateDeliveryDto, { fee: -1 }))).map((e) => e.property)).toEqual(['fee']);
  });
});
