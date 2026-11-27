import { Injectable } from '@nestjs/common';
import { deliveryFeeCents, discountCents, toCents } from '../common/order-total';
import { centsToDecimal } from '../purchasing/purchase-rules';
import { PrismaService } from '../prisma.service';
import { buildSalesReport, ItemStat, PaidSale, PaymentMethod, REMOVED_CATEGORY } from './sales-rules';

const item = ({ revenueCents, ...stat }: ItemStat) => ({ ...stat, revenue: centsToDecimal(revenueCents) });

// Relatórios de vendas (SPEC/2026-11-16-relatorios-de-vendas.md).
@Injectable()
export class SalesReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // RF-01 e RN-01: só comandas pagas no período.
  async report(start: Date, end: Date, limit: number) {
    const orders = await this.prisma.order.findMany({
      where: { status: 'PAID', paidAt: { gte: start, lt: end }, paymentMethod: { not: null } },
      select: {
        paidAt: true,
        paymentMethod: true,
        waiterName: true,
        discount: true,
        deliveryFee: true,
        items: { select: { menuItemId: true, nameSnapshot: true, quantity: true, unitPrice: true, menuItem: { select: { category: true } } } },
      },
    });
    const sales: PaidSale[] = orders.map((order) => ({
      paidAt: order.paidAt!,
      paymentMethod: order.paymentMethod as PaymentMethod,
      waiterName: order.waiterName,
      lines: order.items.map((line) => ({
        key: `${line.menuItemId ?? 'removido'}|${line.nameSnapshot}`,
        name: line.nameSnapshot,
        category: line.menuItem?.category ?? REMOVED_CATEGORY,
        quantity: line.quantity,
        unitPriceCents: toCents(line.unitPrice),
      })),
    }));
    const report = buildSalesReport(sales, limit);
    // RF-06 da SPEC/2026-11-16-programa-de-fidelidade.md: itens pelo preço cheio, descontos à parte.
    const discounts = orders.reduce((sum, order) => sum + discountCents(order), 0);
    const deliveryFees = orders.reduce((sum, order) => sum + deliveryFeeCents(order), 0); // RF-06 da SPEC/2026-11-16-delivery.md
    return {
      from: start.toISOString(),
      to: end.toISOString(),
      paidOrders: report.paidOrders,
      revenue: centsToDecimal(report.revenueCents),
      discounts: centsToDecimal(discounts),
      deliveryFees: centsToDecimal(deliveryFees),
      netRevenue: centsToDecimal(report.revenueCents - discounts + deliveryFees),
      itemsSold: report.itemsSold,
      averageTicket: centsToDecimal(report.averageTicketCents),
      topByQuantity: report.topByQuantity.map(item),
      topByRevenue: report.topByRevenue.map(item),
      byCategory: report.byCategory.map(({ revenueCents, ...rest }) => ({ ...rest, revenue: centsToDecimal(revenueCents) })),
      byHour: report.byHour.map(({ revenueCents, ...rest }) => ({ ...rest, revenue: centsToDecimal(revenueCents) })),
      byWeekday: report.byWeekday.map(({ revenueCents, ...rest }) => ({ ...rest, revenue: centsToDecimal(revenueCents) })),
      byDay: report.byDay.map(({ revenueCents, ...rest }) => ({ ...rest, revenue: centsToDecimal(revenueCents) })),
      byWaiter: report.byWaiter.map(({ revenueCents, averageTicketCents, ...rest }) => ({
        ...rest,
        revenue: centsToDecimal(revenueCents),
        averageTicket: centsToDecimal(averageTicketCents),
      })),
      byPayment: report.byPayment.map(({ revenueCents, ...rest }) => ({ ...rest, revenue: centsToDecimal(revenueCents) })),
      categoryByHour: report.categoryByHour.map(({ category, hours }) => ({ category, hours: hours.map(centsToDecimal) })),
    };
  }
}
