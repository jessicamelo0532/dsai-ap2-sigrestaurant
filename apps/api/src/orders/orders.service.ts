import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { deliveryFeeCents, discountCents, orderTotalCents, subtotalCents } from '../common/order-total';
import { centsToDecimal } from '../purchasing/purchase-rules';
import { PrismaService } from '../prisma.service';
import { deductStockForSale } from '../stock/stock-sale';
import { AddOrderItemDto, CloseOrderDto, UpdateOrderItemDto } from '../dto';
import { cancelPendingTickets } from '../kitchen/kitchen-guard';
import { assertItemEditable } from '../kitchen/kitchen-rules';
import { assertItemChangeFits, creditPayment, refundRedemption } from '../loyalty/loyalty-ledger';
import { assertDiscountFits } from '../loyalty/loyalty-rules';
import { Clock, MENU_CLOCK } from '../menu-availability/menu-clock';
import { prepareOrderLine } from '../order-lines';
import { orderInclude } from './order-include';

@Injectable()
export class OrdersService {
  private readonly now: Clock;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(MENU_CLOCK) clock?: Clock, // RNF-02 da SPEC/2026-11-16-cardapio-por-horario.md
  ) {
    this.now = clock ?? (() => new Date());
  }

  async addOrderItem(tableId: number, dto: AddOrderItemDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "DiningTable" WHERE "id" = ${tableId} FOR UPDATE`;
      const table = await tx.diningTable.findUnique({ where: { id: tableId } });
      if (!table) throw new NotFoundException('Mesa não encontrada.');
      const line = await prepareOrderLine(tx, dto, this.now());
      let order = await tx.order.findFirst({ where: { tableId, status: 'OPEN' }, orderBy: { openedAt: 'desc' } });
      if (!order) order = await tx.order.create({ data: { tableId, tableNumber: table.number } });
      await tx.orderItem.create({ data: { orderId: order.id, ...line } });
      return tx.order.findUnique({ where: { id: order.id }, include: orderInclude });
    });
  }

  async updateOrderItem(orderId: number, itemId: number, dto: UpdateOrderItemDto) {
    const line = await this.prisma.orderItem.findFirst({ where: { id: itemId, orderId }, include: { order: true } });
    if (!line) throw new NotFoundException('Item da comanda não encontrado.');
    if (line.order.status !== 'OPEN') throw new BadRequestException('A comanda não está aberta.');
    assertItemEditable(line); // RN-03 da SPEC/2026-11-16-cozinha-kds.md
    await assertItemChangeFits(this.prisma, line.order, itemId, dto.quantity); // RN-07 da SPEC/2026-11-16-programa-de-fidelidade.md
    await this.prisma.orderItem.update({ where: { id: itemId }, data: { quantity: dto.quantity } });
    return this.prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
  }

  async removeOrderItem(orderId: number, itemId: number) {
    const line = await this.prisma.orderItem.findFirst({ where: { id: itemId, orderId }, include: { order: true } });
    if (!line) throw new NotFoundException('Item da comanda não encontrado.');
    if (line.order.status !== 'OPEN') throw new BadRequestException('A comanda não está aberta.');
    assertItemEditable(line); // RN-03 da SPEC/2026-11-16-cozinha-kds.md
    await assertItemChangeFits(this.prisma, line.order, itemId, 0); // RN-07 da SPEC/2026-11-16-programa-de-fidelidade.md
    await this.prisma.orderItem.delete({ where: { id: itemId } });
    const remaining = await this.prisma.orderItem.count({ where: { orderId } });
    if (!remaining) await this.prisma.order.delete({ where: { id: orderId } });
    return { success: true };
  }

  async closeOrder(id: number, dto: CloseOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      // Trava a comanda para um resgate de pontos não mudar o desconto no meio do pagamento (SPEC/2026-11-16-programa-de-fidelidade.md, RNF-01).
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id }, include: orderInclude });
      if (!order) throw new NotFoundException('Comanda não encontrada.');
      if (order.status !== 'OPEN') throw new BadRequestException('Esta comanda já foi fechada.');
      if (!order.items.length) throw new BadRequestException('Adicione pelo menos um item antes de fechar a conta.');
      assertDiscountFits(subtotalCents(order), discountCents(order)); // RN-10 da SPEC/2026-11-16-programa-de-fidelidade.md
      // Baixa de estoque na mesma transação (SPEC/2026-11-13-estoque-de-ingredientes.md, RF-08).
      await deductStockForSale(tx, order);
      await tx.order.update({ where: { id }, data: { status: 'PAID', paymentMethod: dto.paymentMethod, paidAt: new Date() } });
      await creditPayment(tx, order); // RF-02 da SPEC/2026-11-16-programa-de-fidelidade.md
      return tx.order.findUnique({ where: { id }, include: orderInclude });
    });
  }

  async cancelOrder(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id } });
      if (!order) throw new NotFoundException('Comanda não encontrada.');
      if (order.status !== 'OPEN') throw new BadRequestException('Apenas comandas abertas podem ser canceladas.');
      // RN-08 da SPEC/2026-11-16-cozinha-kds.md
      await cancelPendingTickets(tx, id, new Date());
      await refundRedemption(tx, order); // RN-08 da SPEC/2026-11-16-programa-de-fidelidade.md
      return tx.order.update({ where: { id }, data: { status: 'CANCELLED' }, include: orderInclude });
    });
  }

  async listOpenOrders() {
    // Só o salão; o delivery tem a lista própria (SPEC/2026-11-16-delivery.md, CA-05).
    return this.prisma.order.findMany({ where: { status: 'OPEN', channel: 'DINE_IN' }, include: orderInclude, orderBy: { openedAt: 'asc' } });
  }

  async getOrder(id: number) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException('Comanda não encontrada.');
    // RF-05 da SPEC/2026-11-16-programa-de-fidelidade.md
    return {
      ...order,
      subtotal: centsToDecimal(subtotalCents(order)),
      discount: centsToDecimal(discountCents(order)),
      deliveryFee: centsToDecimal(deliveryFeeCents(order)),
      total: centsToDecimal(orderTotalCents(order)),
    };
  }
}
