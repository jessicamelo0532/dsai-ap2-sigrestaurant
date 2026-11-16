import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { centsToDecimal } from '../purchasing/purchase-rules';
import { AssignWaiterDto, CreateWaiterDto, UpdateWaiterDto } from './waiters.dto';
import { basisPointsToDecimal, DEFAULT_COMMISSION, rateBasisPoints, waiterReport } from './waiter-rules';

const toCents = (value: Prisma.Decimal) => Math.round(Number(value.toString()) * 100);

// Garçons, garçom da comanda e comissão (SPEC/2026-11-16-garcons-e-comissao.md).
@Injectable()
export class WaitersService {
  constructor(private readonly prisma: PrismaService) {}

  // RF-01
  list(includeInactive = false) {
    return this.prisma.waiter.findMany({ where: includeInactive ? {} : { active: true }, orderBy: { name: 'asc' } });
  }

  async get(id: number) {
    const waiter = await this.prisma.waiter.findUnique({ where: { id } });
    if (!waiter) throw new NotFoundException('Garçom não encontrado.');
    return waiter;
  }

  async create(dto: CreateWaiterDto) {
    const name = dto.name.trim();
    await this.assertNameFree(name);
    const rate = basisPointsToDecimal(rateBasisPoints(dto.commissionRate ?? DEFAULT_COMMISSION));
    return this.prisma.waiter.create({ data: { name, commissionRate: rate } });
  }

  async update(id: number, dto: UpdateWaiterDto) {
    await this.get(id);
    const name = dto.name?.trim();
    if (name !== undefined) await this.assertNameFree(name, id);
    return this.prisma.waiter.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(dto.commissionRate !== undefined ? { commissionRate: basisPointsToDecimal(rateBasisPoints(dto.commissionRate)) } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  // RN-04
  async remove(id: number) {
    await this.get(id);
    if (await this.prisma.order.count({ where: { waiterId: id } })) {
      throw new BadRequestException('O garçom tem comandas registradas. Desative em vez de excluir.');
    }
    await this.prisma.waiter.delete({ where: { id } });
    return { success: true };
  }

  // RF-02 e RN-03: guarda nome e taxa do momento da atribuição.
  async assign(orderId: number, dto: AssignWaiterDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Comanda não encontrada.');
    if (order.status !== 'OPEN') throw new BadRequestException('Só comandas abertas podem trocar de garçom.');
    const waiter = await this.get(dto.waiterId);
    if (!waiter.active) throw new BadRequestException(`O garçom ${waiter.name} está inativo.`);
    return this.prisma.order.update({
      where: { id: orderId },
      data: { waiterId: waiter.id, waiterName: waiter.name, commissionRate: waiter.commissionRate },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  }

  // RF-03, RN-05 a RN-07
  async report(start: Date, end: Date) {
    const orders = await this.prisma.order.findMany({
      where: { status: 'PAID', paidAt: { gte: start, lt: end } },
      select: { waiterId: true, waiterName: true, commissionRate: true, items: { select: { quantity: true, unitPrice: true } } },
    });
    const report = waiterReport(orders.map((order) => ({
      waiterId: order.waiterId,
      waiterName: order.waiterName,
      revenueCents: order.items.reduce((total, line) => total + toCents(line.unitPrice) * line.quantity, 0),
      basisPoints: order.commissionRate === null ? 0 : rateBasisPoints(order.commissionRate),
    })));
    return {
      from: start.toISOString(),
      to: end.toISOString(),
      waiters: report.waiters.map(({ revenueCents, commissionCents, averageTicketCents, ...row }) => ({
        ...row,
        revenue: centsToDecimal(revenueCents),
        averageTicket: centsToDecimal(averageTicketCents),
        commission: centsToDecimal(commissionCents),
      })),
      totals: {
        paidOrders: report.totals.paidOrders,
        revenue: centsToDecimal(report.totals.revenueCents),
        commission: centsToDecimal(report.totals.commissionCents),
      },
    };
  }

  // RN-01
  private async assertNameFree(name: string, ignoreId?: number) {
    const same = await this.prisma.waiter.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...(ignoreId !== undefined ? { id: { not: ignoreId } } : {}) },
    });
    if (same) throw new BadRequestException(`Já existe um garçom chamado ${same.name}.`);
  }
}
