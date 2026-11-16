import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { KitchenPriorityChange, KitchenTicket, OrderItem, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { KitchenPriorityDto, SendToKitchenDto } from './kitchen.dto';
import {
  Action,
  assertPriorityChange,
  changedByName,
  delayBand,
  nextStatus,
  parsePriority,
  QUEUE_STATUSES,
  sortQueue,
  summarizeQueue,
  ticketNote,
  timestampField,
  waitingMinutes,
} from './kitchen-rules';

// O relógio é injetável para testes (RNF-03).
export const KITCHEN_CLOCK = 'KITCHEN_CLOCK';
export type Clock = () => Date;

const ticketInclude = {
  items: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
  order: { select: { tableNumber: true, waiterName: true } },
};
type TicketRow = KitchenTicket & { items: OrderItem[]; order: { tableNumber: number; waiterName: string | null } };

const NOT_FOUND = 'Pedido de cozinha não encontrado.';

// Envio para a cozinha e fila de produção (SPEC/2026-11-16-cozinha-kds.md).
@Injectable()
export class KitchenService {
  private readonly now: Clock;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(KITCHEN_CLOCK) clock?: Clock,
  ) {
    this.now = clock ?? (() => new Date());
  }

  // RF-01, RN-01, RN-02 e RNF-01
  async send(orderId: number, dto: SendToKitchenDto = {}) {
    const note = ticketNote(dto.note);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Comanda não encontrada.');
      if (order.status !== 'OPEN') throw new BadRequestException('Só comandas abertas podem enviar pedidos para a cozinha.');
      const pending = await tx.orderItem.count({ where: { orderId, ticketId: null } });
      if (!pending) throw new BadRequestException('Não há itens novos para enviar à cozinha.');
      const ticket = await tx.kitchenTicket.create({ data: { orderId, note, sentAt: this.now() } });
      await tx.orderItem.updateMany({ where: { orderId, ticketId: null }, data: { ticketId: ticket.id } });
      return this.present(await tx.kitchenTicket.findUniqueOrThrow({ where: { id: ticket.id }, include: ticketInclude }));
    });
  }

  // RF-06
  async listForOrder(orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Comanda não encontrada.');
    const [tickets, pendingItems] = await Promise.all([
      this.prisma.kitchenTicket.findMany({ where: { orderId }, include: ticketInclude, orderBy: [{ sentAt: 'asc' }, { id: 'asc' }] }),
      this.prisma.orderItem.count({ where: { orderId, ticketId: null } }),
    ]);
    return { orderId, pendingItems, tickets: tickets.map((ticket) => this.present(ticket)) };
  }

  // RF-02
  async queue() {
    const rows = await this.prisma.kitchenTicket.findMany({
      where: { status: { in: [...QUEUE_STATUSES] } },
      include: ticketInclude,
    });
    const tickets = sortQueue(rows).map((row) => this.present(row));
    return { generatedAt: this.now(), summary: summarizeQueue(tickets), tickets };
  }

  // RF-05
  async get(id: number) {
    const ticket = await this.prisma.kitchenTicket.findUnique({
      where: { id },
      include: { ...ticketInclude, priorityChanges: { orderBy: [{ changedAt: 'asc' }, { id: 'asc' }] } },
    });
    if (!ticket) throw new NotFoundException(NOT_FOUND);
    return { ...this.present(ticket), priorityChanges: ticket.priorityChanges.map(presentChange) };
  }

  // RF-03, RN-06 e RNF-02
  async advance(id: number, action: Action) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await this.lockTicket(tx, id);
      const status = nextStatus(ticket.status, action);
      const data: Prisma.KitchenTicketUpdateInput = { status };
      data[timestampField(action)] = this.now();
      await tx.kitchenTicket.update({ where: { id }, data });
      return this.present(await tx.kitchenTicket.findUniqueOrThrow({ where: { id }, include: ticketInclude }));
    });
  }

  // RF-04 e RN-07
  async setPriority(id: number, dto: KitchenPriorityDto) {
    const priority = parsePriority(dto.priority);
    const changedBy = changedByName(dto.changedBy);
    await this.prisma.$transaction(async (tx) => {
      const ticket = await this.lockTicket(tx, id);
      assertPriorityChange(ticket.status, ticket.priority, priority);
      await tx.kitchenTicket.update({ where: { id }, data: { priority } });
      await tx.kitchenPriorityChange.create({
        data: { ticketId: id, from: ticket.priority, to: priority, changedBy, changedAt: this.now() },
      });
    });
    return this.get(id);
  }

  private async lockTicket(tx: Prisma.TransactionClient, id: number) {
    await tx.$queryRaw`SELECT "id" FROM "KitchenTicket" WHERE "id" = ${id} FOR UPDATE`;
    const ticket = await tx.kitchenTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException(NOT_FOUND);
    return ticket;
  }

  // RN-04, RN-05 e RN-10: a mesa vem da comanda, então segue transferências.
  private present(ticket: TicketRow) {
    const minutes = waitingMinutes(ticket.sentAt, ticket.readyAt, this.now());
    return {
      id: ticket.id,
      orderId: ticket.orderId,
      tableNumber: ticket.order.tableNumber,
      waiterName: ticket.order.waiterName,
      status: ticket.status,
      priority: ticket.priority,
      note: ticket.note,
      sentAt: ticket.sentAt,
      startedAt: ticket.startedAt,
      readyAt: ticket.readyAt,
      deliveredAt: ticket.deliveredAt,
      cancelledAt: ticket.cancelledAt,
      waitingMinutes: minutes,
      band: delayBand(minutes),
      items: ticket.items.map((item) => ({ id: item.id, name: item.nameSnapshot, quantity: item.quantity })),
    };
  }
}

function presentChange(change: KitchenPriorityChange) {
  return { from: change.from, to: change.to, changedBy: change.changedBy, changedAt: change.changedAt };
}
