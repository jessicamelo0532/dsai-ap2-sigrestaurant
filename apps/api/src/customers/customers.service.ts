import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Customer, Prisma } from '@prisma/client';
import { dateRange } from '../common/period';
import { PrismaService } from '../prisma.service';
import { AssignCustomerDto, CreateCustomerDto, UpdateCustomerDto } from './customers.dto';
import {
  customerHistory,
  customerName,
  customerNotes,
  customerPhone,
  dedupeKey,
  DUPLICATE_MESSAGE,
  nameKey,
  searchTerms,
} from './customer-rules';

const toCents = (value: Prisma.Decimal) => Math.round(Number(value.toString()) * 100);
const NOT_FOUND = 'Cliente não encontrado.';

// Cadastro de clientes e histórico de consumo (SPEC/2026-11-16-clientes-e-historico.md).
@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  // RF-02
  list(search?: string, includeInactive = false) {
    const terms = searchTerms(search);
    const match: Prisma.CustomerWhereInput[] = terms
      ? [{ nameKey: { contains: terms.name } }, ...(terms.digits ? [{ phone: { contains: terms.digits } }] : [])]
      : [];
    return this.prisma.customer.findMany({
      where: { ...(includeInactive ? {} : { active: true }), ...(match.length ? { OR: match } : {}) },
      orderBy: [{ nameKey: 'asc' }, { id: 'asc' }],
    });
  }

  async get(id: number) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException(NOT_FOUND);
    return customer;
  }

  // RF-01, RN-01 a RN-04
  async create(dto: CreateCustomerDto) {
    const name = customerName(dto.name);
    const phone = customerPhone(dto.phone);
    const notes = customerNotes(dto.notes);
    return this.saveUnique(() =>
      this.prisma.customer.create({ data: { name, phone, notes, nameKey: nameKey(name), dedupeKey: dedupeKey(name, phone) } }),
    );
  }

  // RF-03: só muda o que veio no corpo.
  async update(id: number, dto: UpdateCustomerDto) {
    const current = await this.get(id);
    const name = dto.name === undefined ? current.name : customerName(dto.name);
    const phone = dto.phone === undefined ? current.phone : customerPhone(dto.phone);
    const notes = dto.notes === undefined ? current.notes : customerNotes(dto.notes);
    const active = dto.active ?? current.active;
    return this.saveUnique(() =>
      this.prisma.customer.update({
        where: { id },
        data: { name, phone, notes, active, nameKey: nameKey(name), dedupeKey: dedupeKey(name, phone) },
      }),
    );
  }

  // RF-04, RN-05 e RN-06
  async assignToOrder(orderId: number, dto: AssignCustomerDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Comanda não encontrada.');
      if (order.status !== 'OPEN') throw new BadRequestException('Só comandas abertas podem mudar de cliente.');
      if (dto.customerId !== null) {
        const customer = await tx.customer.findUnique({ where: { id: dto.customerId } });
        if (!customer) throw new NotFoundException(NOT_FOUND);
        if (!customer.active) throw new BadRequestException('Este cliente está desativado.');
      }
      return tx.order.update({
        where: { id: orderId },
        data: { customerId: dto.customerId },
        include: { customer: true, items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
      });
    });
  }

  // RF-05 e RN-07: só comandas pagas, filtradas pela data de pagamento.
  async history(id: number, from?: string, to?: string) {
    const customer = await this.get(id);
    const range = from === undefined && to === undefined ? null : dateRange(from, to);
    const orders = await this.prisma.order.findMany({
      where: { customerId: id, status: 'PAID', ...(range ? { paidAt: { gte: range[0], lt: range[1] } } : {}) },
      select: { id: true, paidAt: true, tableNumber: true, items: { select: { nameSnapshot: true, quantity: true, unitPrice: true } } },
    });
    const paid = orders.map((order) => ({
      id: order.id,
      paidAt: order.paidAt!,
      tableNumber: order.tableNumber,
      totalCents: order.items.reduce((sum, line) => sum + toCents(line.unitPrice) * line.quantity, 0),
      items: order.items.map((line) => ({ name: line.nameSnapshot, quantity: line.quantity })),
    }));
    return { customer, period: range ? { from, to } : null, ...customerHistory(paid) };
  }

  // RNF-01: o índice único do banco decide, mesmo com cadastros simultâneos.
  private async saveUnique(save: () => Promise<Customer>) {
    try {
      return await save();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }
}
