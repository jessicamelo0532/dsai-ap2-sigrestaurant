import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { discountCents, orderTotalCents, subtotalCents } from '../common/order-total';
import { PrismaService } from '../prisma.service';
import { centsToDecimal } from '../purchasing/purchase-rules';
import { balanceOf, loadRule, lockCustomer, refundRedemption } from './loyalty-ledger';
import { LoyaltySettingsDto, RedeemPointsDto } from './loyalty.dto';
import { balanceValueCents, mergeRule, redemption } from './loyalty-rules';

const OPEN_ONLY = 'Só comandas abertas aceitam resgate de pontos.';

// Programa de fidelidade (SPEC/2026-11-16-programa-de-fidelidade.md).
@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  // RF-01
  getSettings() {
    return loadRule(this.prisma);
  }

  async updateSettings(dto: LoyaltySettingsDto) {
    const rule = mergeRule(await loadRule(this.prisma), dto);
    await this.prisma.loyaltySettings.upsert({ where: { id: 1 }, create: { id: 1, ...rule }, update: rule });
    return rule;
  }

  // RF-03
  async customerLoyalty(customerId: number) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Cliente não encontrado.');
    const [balance, entries, rule] = await Promise.all([
      balanceOf(this.prisma, customerId),
      this.prisma.loyaltyEntry.findMany({ where: { customerId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      loadRule(this.prisma),
    ]);
    return {
      customerId,
      balance,
      balanceValue: centsToDecimal(balanceValueCents(balance, rule)),
      entries: entries.map(({ id, type, points, orderId, createdAt }) => ({ id, type, points, orderId, createdAt })),
    };
  }

  // RF-04, RN-03 a RN-06 e RNF-01
  async redeem(orderId: number, dto: RedeemPointsDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, orderId);
      if (order.customerId === null) throw new BadRequestException('Ligue um cliente à comanda antes de resgatar pontos.');
      await lockCustomer(tx, order.customerId);
      const { points, discountCents: discount } = redemption({
        points: dto.points,
        balance: await balanceOf(tx, order.customerId),
        subtotalCents: subtotalCents(order),
        hasRedemption: order.loyaltyPoints > 0,
        rule: await loadRule(tx),
      });
      await tx.loyaltyEntry.create({ data: { customerId: order.customerId, orderId, type: 'REDEEM', points: -points } });
      await tx.order.update({ where: { id: orderId }, data: { discount: centsToDecimal(discount), loyaltyPoints: points } });
      return this.view(tx, orderId);
    });
  }

  // RF-04: desfaz o resgate.
  async undo(orderId: number) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, orderId);
      if (order.loyaltyPoints <= 0) throw new BadRequestException('Esta comanda não tem resgate de pontos.');
      await refundRedemption(tx, order);
      return this.view(tx, orderId);
    });
  }

  private async lockOrder(tx: Prisma.TransactionClient, orderId: number) {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new NotFoundException('Comanda não encontrada.');
    if (order.status !== 'OPEN') throw new BadRequestException(OPEN_ONLY);
    return order;
  }

  // RF-05: a comanda com subtotal, desconto, total e o saldo que sobrou.
  private async view(tx: Prisma.TransactionClient, orderId: number) {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } } });
    return {
      ...order,
      subtotal: centsToDecimal(subtotalCents(order)),
      discount: centsToDecimal(discountCents(order)),
      total: centsToDecimal(orderTotalCents(order)),
      balance: order.customerId === null ? 0 : await balanceOf(tx, order.customerId),
    };
  }
}
