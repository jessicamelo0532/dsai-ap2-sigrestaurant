import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { MonthlyClosing, Prisma } from '@prisma/client';
import { orderTotalCents, orderTotalSelect, toCents } from '../common/order-total';
import { PrismaService } from '../prisma.service';
import { centsToDecimal } from '../purchasing/purchase-rules';
import { CloseMonthDto, ReopenMonthDto } from './closings.dto';
import {
  assertMonthEnded,
  assertReopenReason,
  buildDre,
  divergences,
  Dre,
  MonthRange,
  parseMonth,
  previousMonth,
  variation,
} from './closing-rules';

// O relógio é injetável para testar "mês já terminou" sem depender da data real (RNF-02).
export const CLOSING_CLOCK = 'CLOSING_CLOCK';
export type Clock = () => Date;

type Db = Pick<Prisma.TransactionClient, 'order' | 'expense'>;
type Method = keyof Dre['paymentsCents'];


// Valores da DRE em texto com 2 casas, como o restante da API devolve dinheiro.
function present(dre: Dre) {
  return {
    revenue: centsToDecimal(dre.revenueCents),
    payments: {
      CASH: centsToDecimal(dre.paymentsCents.CASH),
      CREDIT: centsToDecimal(dre.paymentsCents.CREDIT),
      DEBIT: centsToDecimal(dre.paymentsCents.DEBIT),
      PIX: centsToDecimal(dre.paymentsCents.PIX),
    },
    purchases: centsToDecimal(dre.purchasesCents),
    otherExpenses: centsToDecimal(dre.otherExpensesCents),
    expenses: centsToDecimal(dre.expensesCents),
    result: centsToDecimal(dre.resultCents),
    paidOrders: dre.paidOrders,
    averageTicket: centsToDecimal(dre.averageTicketCents),
  };
}

// Colunas guardadas no fechamento, a partir da DRE.
function toColumns(dre: Dre) {
  return {
    revenue: centsToDecimal(dre.revenueCents),
    cash: centsToDecimal(dre.paymentsCents.CASH),
    credit: centsToDecimal(dre.paymentsCents.CREDIT),
    debit: centsToDecimal(dre.paymentsCents.DEBIT),
    pix: centsToDecimal(dre.paymentsCents.PIX),
    purchases: centsToDecimal(dre.purchasesCents),
    otherExpenses: centsToDecimal(dre.otherExpensesCents),
    result: centsToDecimal(dre.resultCents),
    paidOrders: dre.paidOrders,
    averageTicket: centsToDecimal(dre.averageTicketCents),
  };
}

// DRE guardada no fechamento, de volta em centavos.
function fromClosing(closing: MonthlyClosing): Dre {
  const purchasesCents = toCents(closing.purchases);
  const otherExpensesCents = toCents(closing.otherExpenses);
  return {
    revenueCents: toCents(closing.revenue),
    paymentsCents: {
      CASH: toCents(closing.cash),
      CREDIT: toCents(closing.credit),
      DEBIT: toCents(closing.debit),
      PIX: toCents(closing.pix),
    },
    purchasesCents,
    otherExpensesCents,
    expensesCents: purchasesCents + otherExpensesCents,
    resultCents: toCents(closing.result),
    paidOrders: closing.paidOrders,
    averageTicketCents: toCents(closing.averageTicket),
  };
}

// Fechamento mensal (SPEC/2026-11-16-fechamento-mensal.md).
@Injectable()
export class ClosingsService {
  private readonly now: Clock;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(CLOSING_CLOCK) clock?: Clock,
  ) {
    this.now = clock ?? (() => new Date());
  }

  // RF-04
  async list() {
    const closings = await this.prisma.monthlyClosing.findMany({ orderBy: { month: 'desc' } });
    return closings.map((closing) => this.describe(closing));
  }

  // RF-01: DRE do mês, comparação com o anterior e, se fechado, valores guardados e divergências.
  async getMonth(value: string | undefined) {
    const range = parseMonth(value);
    const previous = parseMonth(previousMonth(range.month));
    const [current, before, closing] = await Promise.all([
      this.compute(this.prisma, range),
      this.compute(this.prisma, previous),
      this.prisma.monthlyClosing.findUnique({ where: { month: range.month } }),
    ]);
    return {
      month: range.month,
      label: range.label,
      status: closing?.status ?? 'OPEN',
      dre: present(current),
      previous: { month: previous.month, dre: present(before) },
      variation: {
        revenue: variation(current.revenueCents, before.revenueCents),
        result: variation(current.resultCents, before.resultCents),
      },
      closing: closing
        ? {
            ...this.describe(closing),
            divergences: closing.status === 'CLOSED' ? divergences(fromClosing(closing), current) : [],
          }
        : null,
    };
  }

  // RF-02 e RN-06
  async close(dto: CloseMonthDto) {
    const range = parseMonth(dto.month);
    assertMonthEnded(range, this.now());
    const closing = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${range.month}))`;
      const existing = await tx.monthlyClosing.findUnique({ where: { month: range.month } });
      if (existing?.status === 'CLOSED') throw new BadRequestException(`O mês ${range.label} já está fechado.`);
      const values = toColumns(await this.compute(tx, range));
      const notes = dto.notes?.trim() || null;
      if (existing) {
        return tx.monthlyClosing.update({
          where: { month: range.month },
          data: { ...values, notes, status: 'CLOSED', revision: { increment: 1 }, closedAt: this.now() },
        });
      }
      return tx.monthlyClosing.create({ data: { month: range.month, ...values, notes, closedAt: this.now() } });
    });
    return this.describe(closing);
  }

  // RF-03 e RN-08
  async reopen(month: string, dto: ReopenMonthDto) {
    const range = parseMonth(month);
    const reason = assertReopenReason(dto.reason);
    const closing = await this.prisma.monthlyClosing.findUnique({ where: { month: range.month } });
    if (!closing) throw new NotFoundException('Fechamento não encontrado.');
    if (closing.status !== 'CLOSED') throw new BadRequestException(`O mês ${range.label} não está fechado.`);
    const reopened = await this.prisma.monthlyClosing.update({
      where: { month: range.month },
      data: { status: 'REOPENED', reopenedAt: this.now(), reopenReason: reason },
    });
    return this.describe(reopened);
  }

  // RN-02 e RN-03: comandas pagas e despesas do mês.
  private async compute(db: Db, range: MonthRange): Promise<Dre> {
    const [orders, expenses] = await Promise.all([
      db.order.findMany({
        where: { status: 'PAID', paidAt: { gte: range.start, lt: range.end }, paymentMethod: { not: null } },
        select: { paymentMethod: true, ...orderTotalSelect },
      }),
      db.expense.findMany({
        where: { incurredAt: { gte: range.start, lt: range.end } },
        select: { amount: true, purchase: { select: { id: true } } },
      }),
    ]);
    return buildDre(
      orders.map((order) => ({
        paymentMethod: order.paymentMethod as Method,
        totalCents: orderTotalCents(order),
      })),
      expenses.map((expense) => ({ amountCents: toCents(expense.amount), fromPurchase: expense.purchase !== null })),
    );
  }

  private describe(closing: MonthlyClosing) {
    return {
      month: closing.month,
      label: parseMonth(closing.month).label,
      status: closing.status,
      revision: closing.revision,
      closedAt: closing.closedAt,
      notes: closing.notes,
      reopenedAt: closing.reopenedAt,
      reopenReason: closing.reopenReason,
      stored: present(fromClosing(closing)),
    };
  }
}
