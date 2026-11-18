import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma, Receivable } from '@prisma/client';
import { assertDiscountFits } from '../loyalty/loyalty-rules';
import { discountCents, orderTotalCents, subtotalCents } from '../common/order-total';
import { PrismaService } from '../prisma.service';
import { centsToDecimal, payableSituation, startOfUtcDay, summarizePayables } from '../purchasing/purchase-rules';
import { deductStockForSale } from '../stock/stock-sale';
import { assertOpenReceivable, dueDate, MESSAGES, receiptDate, receivableNotes, statusFilter } from './receivable-rules';
import { ReceiveDto, SellOnAccountDto } from './receivables.dto';

export const RECEIVABLES_CLOCK = 'RECEIVABLES_CLOCK';
export type Clock = () => Date;

const toCents = (value: Prisma.Decimal) => Math.round(Number(value.toString()) * 100);
const day = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);
type WithRelations = Receivable & { customer: { name: string }; order: { tableNumber: number } };

// Contas a receber (SPEC/2026-11-17-contas-a-receber.md).
@Injectable()
export class ReceivablesService {
  private readonly now: Clock;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(RECEIVABLES_CLOCK) clock?: Clock,
  ) {
    this.now = clock ?? (() => new Date());
  }

  // RF-01, RN-01 a RN-04 e RNF-01: fecha a comanda a prazo e cria o título.
  async sellOnAccount(orderId: number, dto: SellOnAccountDto) {
    const today = this.now();
    const due = dueDate(dto.dueDate, today);
    const notes = receivableNotes(dto.notes);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: { include: { addons: true } } } });
      if (!order) throw new NotFoundException('Comanda não encontrada.');
      if (order.status !== 'OPEN') throw new BadRequestException('Esta comanda já foi fechada.');
      if (!order.items.length) throw new BadRequestException('Adicione pelo menos um item antes de fechar a conta.');
      const customerId = dto.customerId ?? order.customerId;
      if (!customerId) throw new BadRequestException(MESSAGES.customer);
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) throw new NotFoundException('Cliente não encontrado.');
      if (!customer.active) throw new BadRequestException(MESSAGES.inactive);
      assertDiscountFits(subtotalCents(order), discountCents(order));
      await deductStockForSale(tx, order);
      await tx.order.update({ where: { id: orderId }, data: { status: 'ON_ACCOUNT', customerId } });
      const receivable = await tx.receivable.create({
        data: {
          orderId, customerId, amount: centsToDecimal(orderTotalCents(order)),
          issuedAt: startOfUtcDay(today), dueDate: due, notes,
        },
        include: { customer: { select: { name: true } }, order: { select: { tableNumber: true } } },
      });
      return this.describe(receivable, startOfUtcDay(today));
    });
  }

  // RF-02 e RN-07
  async list(status?: string) {
    const today = startOfUtcDay(this.now());
    const filter = statusFilter(status);
    const all = await this.prisma.receivable.findMany({
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      include: { customer: { select: { name: true } }, order: { select: { tableNumber: true } } },
    });
    const open = all.filter((receivable) => receivable.status === 'OPEN');
    const paid = all.filter((receivable) => receivable.status === 'PAID');
    const summary = summarizePayables(open.map((receivable) => ({ dueDate: receivable.dueDate, totalCents: toCents(receivable.amount) })), today);
    const receivedCents = paid.reduce((sum, receivable) => sum + toCents(receivable.amount), 0);
    return {
      today: day(today),
      summary: {
        openCount: summary.count,
        open: centsToDecimal(summary.openCents),
        overdue: centsToDecimal(summary.overdueCents),
        dueNext7Days: centsToDecimal(summary.dueNext7DaysCents),
        paidCount: paid.length,
        received: centsToDecimal(receivedCents),
      },
      receivables: all.filter((receivable) => !filter || receivable.status === filter).map((receivable) => this.describe(receivable, today)),
    };
  }

  // RF-03 e RN-06
  async receive(id: number, dto: ReceiveDto) {
    const today = this.now();
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Receivable" WHERE "id" = ${id} FOR UPDATE`;
      const receivable = await tx.receivable.findUnique({ where: { id } });
      if (!receivable) throw new NotFoundException(MESSAGES.notFound);
      assertOpenReceivable(receivable.status);
      const receivedAt = receiptDate(dto.receivedAt, receivable.issuedAt, today);
      const updated = await tx.receivable.update({
        where: { id },
        data: { status: 'PAID', paymentMethod: dto.paymentMethod, receivedAt },
        include: { customer: { select: { name: true } }, order: { select: { tableNumber: true } } },
      });
      return this.describe(updated, startOfUtcDay(today));
    });
  }

  private describe(receivable: WithRelations, today: Date) {
    return {
      id: receivable.id,
      orderId: receivable.orderId,
      tableNumber: receivable.order.tableNumber,
      customerId: receivable.customerId,
      customerName: receivable.customer.name,
      amount: centsToDecimal(toCents(receivable.amount)),
      issuedAt: day(receivable.issuedAt),
      dueDate: day(receivable.dueDate),
      status: receivable.status,
      situation: receivable.status === 'OPEN' ? payableSituation(receivable.dueDate, today) : null,
      paymentMethod: receivable.paymentMethod,
      receivedAt: day(receivable.receivedAt),
      notes: receivable.notes,
    };
  }
}
