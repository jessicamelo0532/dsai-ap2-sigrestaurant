import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { deliveryFeeCents, orderTotalCents, orderTotalSelect } from '../common/order-total';
import { revenueByChannel } from '../delivery/delivery-rules';
import { PrismaService } from '../prisma.service';
import { centsToDecimal } from '../purchasing/purchase-rules';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async report(from: Date, to: Date) {
    const [expenses, paymentRows] = await Promise.all([
      this.prisma.expense.aggregate({ where: { incurredAt: { gte: from, lt: to } }, _sum: { amount: true }, _count: { id: true } }),
      this.prisma.order.findMany({
        where: { status: 'PAID', paidAt: { gte: from, lt: to } },
        select: { id: true, paymentMethod: true, channel: true, ...orderTotalSelect },
      }),
    ]);
    const paymentTotals: Record<string, Prisma.Decimal> = { CASH: new Prisma.Decimal(0), CREDIT: new Prisma.Decimal(0), DEBIT: new Prisma.Decimal(0), PIX: new Prisma.Decimal(0) };
    for (const order of paymentRows) {
      const total = new Prisma.Decimal(centsToDecimal(orderTotalCents(order)));
      if (order.paymentMethod) paymentTotals[order.paymentMethod] = paymentTotals[order.paymentMethod].plus(total);
    }
    const revenue = Object.values(paymentTotals).reduce((sum, amount) => sum.plus(amount), new Prisma.Decimal(0));
    const expenseTotal = expenses._sum.amount ?? new Prisma.Decimal(0);
    return {
      from: from.toISOString(), to: to.toISOString(),
      paidOrders: paymentRows.length,
      revenue: revenue.toFixed(2),
      expenses: expenseTotal.toFixed(2),
      expenseCount: expenses._count.id,
      balance: revenue.minus(expenseTotal).toFixed(2),
      payments: Object.fromEntries(Object.entries(paymentTotals).map(([method, amount]) => [method, amount.toFixed(2)])),
      // RF-06 da SPEC/2026-11-16-delivery.md: receita por canal e soma das taxas.
      byChannel: Object.fromEntries(
        Object.entries(
          revenueByChannel(paymentRows.map((order) => ({ channel: order.channel, totalCents: orderTotalCents(order), feeCents: deliveryFeeCents(order) }))),
        ).map(([key, cents]) => [key, centsToDecimal(cents)]),
      ),
    };
  }
}
