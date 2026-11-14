import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { AddOrderItemDto, CloseOrderDto, CreateExpenseDto, CreateMenuItemDto, CreateTableDto, UpdateExpenseDto, UpdateMenuItemDto, UpdateOrderItemDto } from './dto';

const orderInclude = { items: { orderBy: { createdAt: 'asc' as const } } };

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async listTables() {
    const tables = await this.prisma.diningTable.findMany({
      orderBy: { number: 'asc' },
      include: { orders: { where: { status: 'OPEN' }, include: orderInclude, take: 1 } },
    });
    return tables.map(({ orders, ...table }) => ({ ...table, order: orders[0] ?? null }));
  }

  async createTable(dto: CreateTableDto) {
    if (await this.prisma.diningTable.findUnique({ where: { number: dto.number } })) {
      throw new BadRequestException('Já existe uma mesa com esse número.');
    }
    return this.prisma.diningTable.create({ data: dto });
  }

  async deleteTable(id: number) {
    const table = await this.prisma.diningTable.findUnique({ where: { id } });
    if (!table) throw new NotFoundException('Mesa não encontrada.');
    const open = await this.prisma.order.findFirst({ where: { tableId: id, status: 'OPEN' } });
    if (open) throw new BadRequestException('Feche a comanda antes de remover esta mesa.');
    // RN-09 da SPEC/2026-11-12-reservas-de-mesa.md
    const booked = await this.prisma.reservation.findFirst({
      where: { tableId: id, status: 'BOOKED', endsAt: { gt: new Date() } },
    });
    if (booked) throw new BadRequestException('Esta mesa tem reservas agendadas. Cancele ou remarque antes de remover.');
    await this.prisma.diningTable.delete({ where: { id } });
    return { success: true };
  }

  listMenu(includeUnavailable = false) {
    return this.prisma.menuItem.findMany({
      where: includeUnavailable ? undefined : { available: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  getMenuItem(id: number) {
    return this.requireMenuItem(id);
  }

  createMenuItem(dto: CreateMenuItemDto) {
    return this.prisma.menuItem.create({ data: { ...dto, price: new Prisma.Decimal(dto.price), category: dto.category || 'Geral' } });
  }

  async updateMenuItem(id: number, dto: UpdateMenuItemDto) {
    await this.requireMenuItem(id);
    return this.prisma.menuItem.update({
      where: { id }, data: { ...dto, ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}) },
    });
  }

  async deleteMenuItem(id: number) {
    await this.requireMenuItem(id);
    await this.prisma.menuItem.delete({ where: { id } });
    return { success: true };
  }

  async addOrderItem(tableId: number, dto: AddOrderItemDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "DiningTable" WHERE "id" = ${tableId} FOR UPDATE`;
      const table = await tx.diningTable.findUnique({ where: { id: tableId } });
      if (!table) throw new NotFoundException('Mesa não encontrada.');
      const item = await tx.menuItem.findFirst({ where: { id: dto.menuItemId, available: true } });
      if (!item) throw new BadRequestException('Este item não está disponível no cardápio.');
      let order = await tx.order.findFirst({ where: { tableId, status: 'OPEN' }, orderBy: { openedAt: 'desc' } });
      if (!order) order = await tx.order.create({ data: { tableId, tableNumber: table.number } });
      await tx.orderItem.create({
        data: { orderId: order.id, menuItemId: item.id, nameSnapshot: item.name, unitPrice: item.price, quantity: dto.quantity },
      });
      return tx.order.findUnique({ where: { id: order.id }, include: orderInclude });
    });
  }

  async updateOrderItem(orderId: number, itemId: number, dto: UpdateOrderItemDto) {
    const line = await this.prisma.orderItem.findFirst({ where: { id: itemId, orderId }, include: { order: true } });
    if (!line) throw new NotFoundException('Item da comanda não encontrado.');
    if (line.order.status !== 'OPEN') throw new BadRequestException('A comanda não está aberta.');
    await this.prisma.orderItem.update({ where: { id: itemId }, data: { quantity: dto.quantity } });
    return this.prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
  }

  async removeOrderItem(orderId: number, itemId: number) {
    const line = await this.prisma.orderItem.findFirst({ where: { id: itemId, orderId }, include: { order: true } });
    if (!line) throw new NotFoundException('Item da comanda não encontrado.');
    if (line.order.status !== 'OPEN') throw new BadRequestException('A comanda não está aberta.');
    await this.prisma.orderItem.delete({ where: { id: itemId } });
    const remaining = await this.prisma.orderItem.count({ where: { orderId } });
    if (!remaining) await this.prisma.order.delete({ where: { id: orderId } });
    return { success: true };
  }

  async closeOrder(id: number, dto: CloseOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, include: orderInclude });
      if (!order) throw new NotFoundException('Comanda não encontrada.');
      if (order.status !== 'OPEN') throw new BadRequestException('Esta comanda já foi fechada.');
      if (!order.items.length) throw new BadRequestException('Adicione pelo menos um item antes de fechar a conta.');
      await tx.order.update({ where: { id }, data: { status: 'PAID', paymentMethod: dto.paymentMethod, paidAt: new Date() } });
      return tx.order.findUnique({ where: { id }, include: orderInclude });
    });
  }

  async cancelOrder(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id } });
      if (!order) throw new NotFoundException('Comanda não encontrada.');
      if (order.status !== 'OPEN') throw new BadRequestException('Apenas comandas abertas podem ser canceladas.');
      return tx.order.update({ where: { id }, data: { status: 'CANCELLED' }, include: orderInclude });
    });
  }

  async createExpense(dto: CreateExpenseDto) {
    const incurredAt = dto.incurredAt ? new Date(dto.incurredAt) : new Date();
    if (Number.isNaN(incurredAt.getTime())) throw new BadRequestException('Data da despesa inválida.');
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
    const incurredAt = dto.incurredAt !== undefined ? new Date(dto.incurredAt) : undefined;
    if (incurredAt && Number.isNaN(incurredAt.getTime())) throw new BadRequestException('Data da despesa inválida.');
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
    await this.prisma.expense.delete({ where: { id } });
    return { success: true };
  }

  async report(from: Date, to: Date) {
    const [expenses, paymentRows] = await Promise.all([
      this.prisma.expense.aggregate({ where: { incurredAt: { gte: from, lt: to } }, _sum: { amount: true }, _count: { id: true } }),
      this.prisma.order.findMany({
        where: { status: 'PAID', paidAt: { gte: from, lt: to } },
        select: { id: true, paymentMethod: true, items: { select: { quantity: true, unitPrice: true } } },
      }),
    ]);
    const paymentTotals: Record<string, Prisma.Decimal> = { CASH: new Prisma.Decimal(0), CREDIT: new Prisma.Decimal(0), DEBIT: new Prisma.Decimal(0), PIX: new Prisma.Decimal(0) };
    for (const order of paymentRows) {
      const total = order.items.reduce((sum, line) => sum.plus(line.unitPrice.mul(line.quantity)), new Prisma.Decimal(0));
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
    };
  }

  async listOpenOrders() {
    return this.prisma.order.findMany({ where: { status: 'OPEN' }, include: orderInclude, orderBy: { openedAt: 'asc' } });
  }

  async getOrder(id: number) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException('Comanda não encontrada.');
    const total = order.items.reduce((sum, item) => sum.plus(item.unitPrice.mul(item.quantity)), new Prisma.Decimal(0));
    return { ...order, total: total.toFixed(2) };
  }

  private async requireMenuItem(id: number) {
    const item = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item do cardápio não encontrado.');
    return item;
  }
}
