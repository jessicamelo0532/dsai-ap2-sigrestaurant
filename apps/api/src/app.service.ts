import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertMonthsOpen } from './closings/closing-guard';
import { discountCents, orderTotalCents, orderTotalSelect, subtotalCents } from './common/order-total';
import { centsToDecimal } from './purchasing/purchase-rules';
import { PrismaService } from './prisma.service';
import { deductStockForSale } from './stock/stock-sale';
import { AddOrderItemDto, CloseOrderDto, CreateExpenseDto, CreateMenuItemDto, CreateTableDto, UpdateExpenseDto, UpdateMenuItemDto, UpdateOrderItemDto } from './dto';
import { cancelPendingTickets } from './kitchen/kitchen-guard';
import { assertItemEditable } from './kitchen/kitchen-rules';
import { assertItemChangeFits, creditPayment, refundRedemption } from './loyalty/loyalty-ledger';
import { assertDiscountFits } from './loyalty/loyalty-rules';
import { isOpenAt, unavailableMessage } from './menu-availability/availability-rules';
import { Clock, MENU_CLOCK } from './menu-availability/menu-clock';
import { resolveCategory } from './menu-categories/category-link';
import { compareMenu } from './menu-categories/category-rules';

const orderInclude = { items: { orderBy: { createdAt: 'asc' as const } } };

@Injectable()
export class AppService {
  private readonly now: Clock;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(MENU_CLOCK) clock?: Clock, // RNF-02 da SPEC/2026-11-16-cardapio-por-horario.md
  ) {
    this.now = clock ?? (() => new Date());
  }

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

  async listMenu(includeUnavailable = false) {
    const items = await this.prisma.menuItem.findMany({
      where: includeUnavailable ? undefined : { available: true },
      include: { availability: true, menuCategory: { select: { sortOrder: true } } },
    });
    const now = this.now();
    return items
      // RF-03 da SPEC/2026-11-16-cardapio-por-horario.md: fora da janela, o item some da lista.
      .filter((item) => includeUnavailable || isOpenAt(item.availability, now))
      // RF-08 da SPEC/2026-11-16-categorias-do-cardapio.md: ordem das categorias cadastradas.
      .sort((a, b) => compareMenu(
        { name: a.name, category: a.category, categoryOrder: a.menuCategory?.sortOrder ?? null },
        { name: b.name, category: b.category, categoryOrder: b.menuCategory?.sortOrder ?? null },
      ))
      .map(({ availability: _windows, menuCategory: _category, ...item }) => item);
  }

  getMenuItem(id: number) {
    return this.requireMenuItem(id);
  }

  async createMenuItem(dto: CreateMenuItemDto) {
    // RN-05 da SPEC/2026-11-16-categorias-do-cardapio.md: o texto liga o item à categoria cadastrada.
    const link = await resolveCategory(this.prisma, dto.category || 'Geral');
    return this.prisma.menuItem.create({ data: { ...dto, price: new Prisma.Decimal(dto.price), ...link } });
  }

  async updateMenuItem(id: number, dto: UpdateMenuItemDto) {
    await this.requireMenuItem(id);
    return this.prisma.menuItem.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
        ...(dto.category !== undefined ? await resolveCategory(this.prisma, dto.category || 'Geral') : {}), // RN-05 da SPEC/2026-11-16-categorias-do-cardapio.md
      },
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
      const item = await tx.menuItem.findFirst({ where: { id: dto.menuItemId, available: true }, include: { availability: true } });
      if (!item) throw new BadRequestException('Este item não está disponível no cardápio.');
      // RF-04 e RN-08 da SPEC/2026-11-16-cardapio-por-horario.md
      if (!isOpenAt(item.availability, this.now())) throw new BadRequestException(unavailableMessage(item.availability, this.now()));
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
    assertItemEditable(line); // RN-03 da SPEC/2026-11-16-cozinha-kds.md
    await assertItemChangeFits(this.prisma, line.order, itemId, dto.quantity); // RN-07 da SPEC/2026-11-16-programa-de-fidelidade.md
    await this.prisma.orderItem.update({ where: { id: itemId }, data: { quantity: dto.quantity } });
    return this.prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
  }

  async removeOrderItem(orderId: number, itemId: number) {
    const line = await this.prisma.orderItem.findFirst({ where: { id: itemId, orderId }, include: { order: true } });
    if (!line) throw new NotFoundException('Item da comanda não encontrado.');
    if (line.order.status !== 'OPEN') throw new BadRequestException('A comanda não está aberta.');
    assertItemEditable(line); // RN-03 da SPEC/2026-11-16-cozinha-kds.md
    await assertItemChangeFits(this.prisma, line.order, itemId, 0); // RN-07 da SPEC/2026-11-16-programa-de-fidelidade.md
    await this.prisma.orderItem.delete({ where: { id: itemId } });
    const remaining = await this.prisma.orderItem.count({ where: { orderId } });
    if (!remaining) await this.prisma.order.delete({ where: { id: orderId } });
    return { success: true };
  }

  async closeOrder(id: number, dto: CloseOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      // Trava a comanda para um resgate de pontos não mudar o desconto no meio do pagamento (SPEC/2026-11-16-programa-de-fidelidade.md, RNF-01).
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id }, include: orderInclude });
      if (!order) throw new NotFoundException('Comanda não encontrada.');
      if (order.status !== 'OPEN') throw new BadRequestException('Esta comanda já foi fechada.');
      if (!order.items.length) throw new BadRequestException('Adicione pelo menos um item antes de fechar a conta.');
      assertDiscountFits(subtotalCents(order), discountCents(order)); // RN-10 da SPEC/2026-11-16-programa-de-fidelidade.md
      // Baixa de estoque na mesma transação (SPEC/2026-11-13-estoque-de-ingredientes.md, RF-08).
      await deductStockForSale(tx, order);
      await tx.order.update({ where: { id }, data: { status: 'PAID', paymentMethod: dto.paymentMethod, paidAt: new Date() } });
      await creditPayment(tx, order); // RF-02 da SPEC/2026-11-16-programa-de-fidelidade.md
      return tx.order.findUnique({ where: { id }, include: orderInclude });
    });
  }

  async cancelOrder(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id } });
      if (!order) throw new NotFoundException('Comanda não encontrada.');
      if (order.status !== 'OPEN') throw new BadRequestException('Apenas comandas abertas podem ser canceladas.');
      // RN-08 da SPEC/2026-11-16-cozinha-kds.md
      await cancelPendingTickets(tx, id, new Date());
      await refundRedemption(tx, order); // RN-08 da SPEC/2026-11-16-programa-de-fidelidade.md
      return tx.order.update({ where: { id }, data: { status: 'CANCELLED' }, include: orderInclude });
    });
  }

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
        select: { id: true, paymentMethod: true, ...orderTotalSelect },
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
    };
  }

  async listOpenOrders() {
    return this.prisma.order.findMany({ where: { status: 'OPEN' }, include: orderInclude, orderBy: { openedAt: 'asc' } });
  }

  async getOrder(id: number) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException('Comanda não encontrada.');
    // RF-05 da SPEC/2026-11-16-programa-de-fidelidade.md
    return {
      ...order,
      subtotal: centsToDecimal(subtotalCents(order)),
      discount: centsToDecimal(discountCents(order)),
      total: centsToDecimal(orderTotalCents(order)),
    };
  }

  private async requireMenuItem(id: number) {
    const item = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item do cardápio não encontrado.');
    return item;
  }
}
