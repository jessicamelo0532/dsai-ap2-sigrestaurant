import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Order, Prisma } from '@prisma/client';
import { deliveryFeeCents, discountCents, orderTotalCents, subtotalCents } from '../common/order-total';
import { customerPhone } from '../customers/customer-rules';
import { AddOrderItemDto } from '../dto';
import { Clock, MENU_CLOCK } from '../menu-availability/menu-clock';
import { prepareOrderLine } from '../order-lines';
import { PrismaService } from '../prisma.service';
import { centsToDecimal } from '../purchasing/purchase-rules';
import { CreateDeliveryDto, UpdateDeliveryDto } from './delivery.dto';
import {
  assertDeliveryEditable,
  DeliveryAction,
  deliveryAddress,
  deliveryTimestamp,
  nextDeliveryStatus,
  parseDeliveryFee,
  recipientName,
} from './delivery-rules';

const NOT_FOUND = 'Pedido de delivery não encontrado.';
const STATUSES = ['RECEIVED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'] as const;
const deliveryInclude = {
  items: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }], include: { addons: { orderBy: { id: 'asc' as const } } } },
};

// Pedidos de delivery (SPEC/2026-11-16-delivery.md). O relógio do cardápio vale para a disponibilidade dos itens.
@Injectable()
export class DeliveryService {
  private readonly now: Clock;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(MENU_CLOCK) clock?: Clock,
  ) {
    this.now = clock ?? (() => new Date());
  }

  // RF-01, RN-01 a RN-03 e RNF-02
  async create(dto: CreateDeliveryDto) {
    const data = {
      recipient: recipientName(dto.recipient),
      deliveryAddress: deliveryAddress(dto.address),
      deliveryPhone: customerPhone(dto.phone),
      deliveryFee: centsToDecimal(parseDeliveryFee(dto.fee)),
    };
    if (dto.customerId !== undefined) {
      const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
      if (!customer) throw new NotFoundException('Cliente não encontrado.');
      if (!customer.active) throw new BadRequestException('Este cliente está desativado.');
    }
    const order = await this.prisma.order.create({
      data: { ...data, tableNumber: 0, channel: 'DELIVERY', deliveryStatus: 'RECEIVED', customerId: dto.customerId ?? null },
    });
    return this.get(order.id);
  }

  // Ativos (não entregues nem cancelados) por padrão; ou por situação.
  async list(status?: string) {
    if (status !== undefined && !(STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException('Informe a situação: RECEIVED, OUT_FOR_DELIVERY, DELIVERED ou CANCELLED.');
    }
    const where: Prisma.OrderWhereInput =
      status === undefined
        ? { channel: 'DELIVERY', status: { not: 'CANCELLED' }, deliveryStatus: { not: 'DELIVERED' } }
        : status === 'CANCELLED'
          ? { channel: 'DELIVERY', status: 'CANCELLED' }
          : { channel: 'DELIVERY', status: { not: 'CANCELLED' }, deliveryStatus: status as 'RECEIVED' };
    const orders = await this.prisma.order.findMany({ where, include: deliveryInclude, orderBy: [{ openedAt: 'asc' }, { id: 'asc' }] });
    return orders.map((order) => this.view(order));
  }

  async get(id: number) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: deliveryInclude });
    if (!order || order.channel !== 'DELIVERY') throw new NotFoundException(NOT_FOUND);
    return this.view(order);
  }

  // RN-05: só muda o que veio no corpo.
  async update(id: number, dto: UpdateDeliveryDto) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lock(tx, id);
      assertDeliveryEditable(order.status, order.deliveryStatus!);
      await tx.order.update({
        where: { id },
        data: {
          ...(dto.recipient !== undefined ? { recipient: recipientName(dto.recipient) } : {}),
          ...(dto.address !== undefined ? { deliveryAddress: deliveryAddress(dto.address) } : {}),
          ...(dto.phone !== undefined ? { deliveryPhone: customerPhone(dto.phone) } : {}),
          ...(dto.fee !== undefined ? { deliveryFee: centsToDecimal(parseDeliveryFee(dto.fee)) } : {}),
        },
      });
    });
    return this.get(id);
  }

  // RF-02 e RN-06
  async addItem(id: number, dto: AddOrderItemDto) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lock(tx, id);
      if (order.status !== 'OPEN') throw new BadRequestException('Só pedidos abertos recebem itens.');
      const line = await prepareOrderLine(tx, dto, this.now());
      await tx.orderItem.create({ data: { orderId: id, ...line } });
    });
    return this.get(id);
  }

  // RF-04 e RN-04
  async advance(id: number, action: DeliveryAction) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lock(tx, id);
      const status = nextDeliveryStatus(order.deliveryStatus!, order.status === 'CANCELLED', action);
      const data: Prisma.OrderUpdateInput = { deliveryStatus: status };
      data[deliveryTimestamp(action)] = this.now();
      await tx.order.update({ where: { id }, data });
    });
    return this.get(id);
  }

  // RNF-01
  private async lock(tx: Prisma.TransactionClient, id: number) {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id } });
    if (!order || order.channel !== 'DELIVERY') throw new NotFoundException(NOT_FOUND);
    return order;
  }

  // RF-03: subtotal, desconto, taxa e total.
  private view(order: Order & { items: Prisma.OrderItemGetPayload<{ include: { addons: true } }>[] }) {
    return {
      ...order,
      subtotal: centsToDecimal(subtotalCents(order)),
      discount: centsToDecimal(discountCents(order)),
      deliveryFee: centsToDecimal(deliveryFeeCents(order)),
      total: centsToDecimal(orderTotalCents(order)),
    };
  }
}
