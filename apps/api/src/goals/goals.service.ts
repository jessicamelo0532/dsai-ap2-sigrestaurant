import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { SalesGoal } from '@prisma/client';
import { parseMonth } from '../closings/closing-rules';
import { orderTotalCents, orderTotalSelect, toCents } from '../common/order-total';
import { dateRange } from '../common/period';
import { PrismaService } from '../prisma.service';
import { centsToDecimal } from '../purchasing/purchase-rules';
import { SetGoalDto } from './goals.dto';
import {
  compare,
  goalAttainment,
  GoalValues,
  monthWindow,
  parseGoal,
  previousMonthWindow,
  previousPeriod,
  summarize,
  Summary,
  Window,
} from './goal-rules';

// O relógio é injetável para testes (RNF-01).
export const GOALS_CLOCK = 'GOALS_CLOCK';
export type Clock = () => Date;

const money = (cents: number | null) => (cents === null ? null : centsToDecimal(cents));
const describeSummary = (summary: Summary) => ({
  revenue: centsToDecimal(summary.revenueCents),
  orders: summary.orders,
  averageTicket: centsToDecimal(summary.averageTicketCents),
});
const describeWindow = (window: Window) => ({ from: window.start.toISOString(), to: window.end.toISOString() });

function goalValues(goal: SalesGoal): GoalValues {
  return {
    revenueCents: goal.revenue === null ? null : toCents(goal.revenue),
    orders: goal.orders,
    averageTicketCents: goal.averageTicket === null ? null : toCents(goal.averageTicket),
  };
}

function describeGoal(goal: SalesGoal) {
  const values = goalValues(goal);
  return { month: goal.month, revenue: money(values.revenueCents), orders: values.orders, averageTicket: money(values.averageTicketCents) };
}

// Metas de vendas e comparativo (SPEC/2026-11-16-metas-de-vendas.md).
@Injectable()
export class GoalsService {
  private readonly now: Clock;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(GOALS_CLOCK) clock?: Clock,
  ) {
    this.now = clock ?? (() => new Date());
  }

  async list(year?: string) {
    if (year !== undefined && !/^\d{4}$/.test(year)) throw new BadRequestException('Informe o ano no formato AAAA.');
    const goals = await this.prisma.salesGoal.findMany({
      where: year === undefined ? {} : { month: { startsWith: `${year}-` } },
      orderBy: { month: 'asc' },
    });
    return goals.map(describeGoal);
  }

  // RF-01, RN-01 e RN-02
  async set(month: string, dto: SetGoalDto) {
    const range = parseMonth(month);
    const values = parseGoal(dto);
    const data = { revenue: money(values.revenueCents), orders: values.orders, averageTicket: money(values.averageTicketCents) };
    const goal = await this.prisma.salesGoal.upsert({ where: { month: range.month }, create: { month: range.month, ...data }, update: data });
    return describeGoal(goal);
  }

  async remove(month: string) {
    const range = parseMonth(month);
    const goal = await this.prisma.salesGoal.findUnique({ where: { month: range.month } });
    if (!goal) throw new NotFoundException('Não há meta para este mês.');
    await this.prisma.salesGoal.delete({ where: { month: range.month } });
    return { success: true };
  }

  // RF-02, RN-03 a RN-06: a meta é sempre a do próprio mês.
  async progress(month: string) {
    const range = parseMonth(month);
    const goal = await this.prisma.salesGoal.findUnique({ where: { month: range.month } });
    const window = monthWindow(range, this.now());
    const previousWindow = previousMonthWindow(range, window);
    const [actual, previous] = await Promise.all([this.summaryBetween(window), this.summaryBetween(previousWindow)]);
    return {
      month: range.month,
      goal: goal ? describeGoal(goal) : null,
      window: describeWindow(window),
      actual: describeSummary(actual),
      attainment: goalAttainment(actual, goal ? goalValues(goal) : null),
      previous: { window: describeWindow(previousWindow), ...describeSummary(previous) },
      variation: compare(actual, previous),
    };
  }

  // RF-03 e RN-07
  async compare(from?: string, to?: string) {
    const [start, end] = dateRange(from, to);
    const current = { start, end };
    const before = previousPeriod(current);
    const [actual, previous] = await Promise.all([this.summaryBetween(current), this.summaryBetween(before)]);
    return {
      current: { window: describeWindow(current), ...describeSummary(actual) },
      previous: { window: describeWindow(before), ...describeSummary(previous) },
      variation: compare(actual, previous),
    };
  }

  // Só comandas pagas, com o total já com desconto (CA-04).
  private async summaryBetween(window: Window) {
    if (window.end.getTime() <= window.start.getTime()) return summarize([]);
    const orders = await this.prisma.order.findMany({
      where: { status: 'PAID', paidAt: { gte: window.start, lt: window.end } },
      select: orderTotalSelect,
    });
    return summarize(orders.map(orderTotalCents));
  }
}
