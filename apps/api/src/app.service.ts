import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertMonthsOpen } from './closings/closing-guard';
import { deliveryFeeCents, orderTotalCents, orderTotalSelect } from './common/order-total';
import { revenueByChannel } from './delivery/delivery-rules';
import { centsToDecimal } from './purchasing/purchase-rules';
import { PrismaService } from './prisma.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async createExpense(dto: CreateExpenseDto) {
    const incurredAt = dto.incurredAt ? new Date(dto.incurredAt) : new Date();
    if (Number.isNaN(incurredAt.getTime())) throw new BadRequestException('Data da despesa inválida.');
    await assertMonthsOpen(this.prisma, incurredAt);
    return this.prisma.expense.create({
      data: { description: dto.description.trim(), amount: new Prisma.Decimal(dto.amount), incurredAt },
    });
  }

  listExpenses(from: Date, to: Date) {
    return this.prisma.expense.findMany({ where: { incurredAt: { gte: from, lt: to } }, orderBy: { incurredAt: 'desc' } });
  }

  async updateExpense(id: number, dto: UpdateExpenseDto) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Despesa não encontrada.');
    await this.assertNotFromPurchase(id);
    const incurredAt = dto.incurredAt !== undefined ? new Date(dto.incurredAt) : undefined;
    if (incurredAt && Number.isNaN(incurredAt.getTime())) throw new BadRequestException('Data da despesa inválida.');
    await assertMonthsOpen(this.prisma, expense.incurredAt, ...(incurredAt ? [incurredAt] : []));
    return this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.amount !== undefined ? { amount: new Prisma.Decimal(dto.amount) } : {}),
        ...(incurredAt ? { incurredAt } : {}),
      },
    });
  }

  async deleteExpense(id: number) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Despesa não encontrada.');
    await this.assertNotFromPurchase(id);
    await assertMonthsOpen(this.prisma, expense.incurredAt);
    await this.prisma.expense.delete({ where: { id } });
    return { success: true };
  }

  // RN-10 da SPEC/2026-11-13-fornecedores-e-contas-a-pagar.md
  private async assertNotFromPurchase(expenseId: number) {
    const purchase = await this.prisma.purchase.findUnique({ where: { expenseId } });
    if (purchase) {
      throw new BadRequestException(`Esta despesa veio do pagamento da compra #${purchase.id} e não pode ser alterada aqui.`);
    }
  }

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
