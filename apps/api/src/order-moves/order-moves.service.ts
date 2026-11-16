import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { text } from '../cash/cash-rules';
import { moveTickets } from '../kitchen/kitchen-guard';
import { PrismaService } from '../prisma.service';
import { MergeOrderDto, TransferOrderDto } from './order-moves.dto';

const orderInclude = { items: { orderBy: { createdAt: 'asc' as const } } };
const REASON_MESSAGE = 'Informe o motivo, de 3 a 200 caracteres.';
const DELIVERY_MESSAGE = 'Pedidos de delivery não mudam de mesa nem são juntados.';

// Transferência e junção de comandas (SPEC/2026-11-16-transferencia-e-juncao-de-comandas.md).
@Injectable()
export class OrderMovesService {
  constructor(private readonly prisma: PrismaService) {}

  // RF-01, RN-01, RN-02 e RN-07
  async transfer(orderId: number, dto: TransferOrderDto) {
    const reason = text(dto.reason, 3, 200, REASON_MESSAGE);
    return this.prisma.$transaction(async (tx) => {
      const order = (await this.lockOrders(tx, [orderId])).get(orderId);
      if (!order) throw new NotFoundException('Comanda não encontrada.');
      if (order.status !== 'OPEN') throw new BadRequestException('Só comandas abertas podem mudar de mesa.');
      if (order.channel === 'DELIVERY') throw new BadRequestException(DELIVERY_MESSAGE); // RN-07 da SPEC/2026-11-16-delivery.md
      if (order.tableId === dto.tableId) throw new BadRequestException('A comanda já está nessa mesa.');
      await tx.$queryRaw`SELECT "id" FROM "DiningTable" WHERE "id" = ${dto.tableId} FOR UPDATE`;
      const table = await tx.diningTable.findUnique({ where: { id: dto.tableId } });
      if (!table) throw new NotFoundException('Mesa não encontrada.');
      if (await tx.order.findFirst({ where: { tableId: table.id, status: 'OPEN' } })) {
        throw new BadRequestException(`A mesa ${table.number} já tem uma comanda aberta. Junte as contas em vez de transferir.`);
      }
      await tx.orderEvent.create({
        data: { orderId, type: 'TRANSFER', fromTableNumber: order.tableNumber, toTableNumber: table.number, reason },
      });
      return tx.order.update({ where: { id: orderId }, data: { tableId: table.id, tableNumber: table.number }, include: orderInclude });
    });
  }

  // RF-02, RN-01 e RN-03 a RN-07: os itens mudam de comanda, sem serem recriados (RNF-02).
  async merge(targetId: number, dto: MergeOrderDto) {
    const reason = text(dto.reason, 3, 200, REASON_MESSAGE);
    if (targetId === dto.sourceOrderId) throw new BadRequestException('Escolha duas comandas diferentes.');
    return this.prisma.$transaction(async (tx) => {
      const orders = await this.lockOrders(tx, [targetId, dto.sourceOrderId]);
      const target = orders.get(targetId);
      const source = orders.get(dto.sourceOrderId);
      if (!target || !source) throw new NotFoundException('Comanda não encontrada.');
      if (target.status !== 'OPEN' || source.status !== 'OPEN') {
        throw new BadRequestException('Só comandas abertas podem ser juntadas.');
      }
      if (target.channel === 'DELIVERY' || source.channel === 'DELIVERY') throw new BadRequestException(DELIVERY_MESSAGE); // RN-07 da SPEC/2026-11-16-delivery.md
      // RN-09 da SPEC/2026-11-16-programa-de-fidelidade.md
      if (source.loyaltyPoints > 0) throw new BadRequestException('Desfaça o resgate de pontos da comanda de origem antes de juntar.');
      await tx.orderItem.updateMany({ where: { orderId: source.id }, data: { orderId: target.id } });
      await moveTickets(tx, source.id, target.id); // RN-09 da SPEC/2026-11-16-cozinha-kds.md
      await tx.order.update({ where: { id: source.id }, data: { status: 'MERGED', mergedIntoId: target.id } });
      // RN-09 da SPEC/2026-11-16-clientes-e-historico.md: o destino sem cliente herda o da origem.
      if (target.customerId === null && source.customerId !== null) {
        await tx.order.update({ where: { id: target.id }, data: { customerId: source.customerId } });
      }
      const event = { type: 'MERGE' as const, fromTableNumber: source.tableNumber, toTableNumber: target.tableNumber, sourceOrderId: source.id, reason };
      await tx.orderEvent.createMany({ data: [{ orderId: target.id, ...event }, { orderId: source.id, ...event }] });
      return tx.order.findUniqueOrThrow({ where: { id: target.id }, include: orderInclude });
    });
  }

  // RF-03
  async history(orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Comanda não encontrada.');
    return this.prisma.orderEvent.findMany({ where: { orderId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  }

  // RNF-01: trava as comandas sempre em ordem crescente de id.
  private async lockOrders(tx: Prisma.TransactionClient, ids: number[]) {
    const sorted = [...ids].sort((a, b) => a - b);
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" IN (${Prisma.join(sorted)}) ORDER BY "id" FOR UPDATE`;
    const orders = await tx.order.findMany({ where: { id: { in: sorted } } });
    return new Map(orders.map((order) => [order.id, order]));
  }
}
