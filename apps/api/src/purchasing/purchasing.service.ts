import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { parseDay } from '../reservations/reservation-rules';
import { recordMovement } from '../stock/stock-ledger';
import { assertNoDuplicateIngredients, fromMilli, positiveMilli, toMilli } from '../stock/stock-rules';
import { CreatePurchaseDto, CreateSupplierDto, PayPurchaseDto, UpdateSupplierDto } from './purchasing.dto';
import {
  assertCanReverse,
  assertItemCount,
  assertOpen,
  assertPaymentDate,
  assertPurchaseDates,
  centsToDecimal,
  lineTotalCents,
  normalizeDocument,
  payableSituation,
  positiveCents,
  PurchaseStatus,
  purchaseTotalCents,
  startOfUtcDay,
  summarizePayables,
} from './purchase-rules';

// O relógio é injetável para testar vencimentos sem depender da data real (RNF-03).
export const PURCHASING_CLOCK = 'PURCHASING_CLOCK';
export type Clock = () => Date;

const purchaseInclude = { supplier: true, items: { orderBy: { id: 'asc' as const } } };
const decimalToCents = (value: Prisma.Decimal) => Math.round(Number(value.toString()) * 100);

// Fornecedores, compras e contas a pagar (SPEC/2026-11-13-fornecedores-e-contas-a-pagar.md).
@Injectable()
export class PurchasingService {
  private readonly now: Clock;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(PURCHASING_CLOCK) clock?: Clock,
  ) {
    this.now = clock ?? (() => new Date());
  }

  // RF-01
  listSuppliers(includeInactive = false) {
    return this.prisma.supplier.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async getSupplier(id: number) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Fornecedor não encontrado.');
    return supplier;
  }

  async createSupplier(dto: CreateSupplierDto) {
    const name = dto.name.trim();
    await this.assertSupplierNameFree(name);
    return this.prisma.supplier.create({
      data: {
        name,
        document: normalizeDocument(dto.document),
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async updateSupplier(id: number, dto: UpdateSupplierDto) {
    await this.getSupplier(id);
    const name = dto.name?.trim();
    if (name !== undefined) await this.assertSupplierNameFree(name, id);
    return this.prisma.supplier.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(dto.document !== undefined ? { document: normalizeDocument(dto.document) } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
        ...(dto.email !== undefined ? { email: dto.email.trim() || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  // RN-03
  async deleteSupplier(id: number) {
    await this.getSupplier(id);
    const purchases = await this.prisma.purchase.count({ where: { supplierId: id } });
    if (purchases) {
      throw new BadRequestException('O fornecedor tem compras registradas. Desative em vez de excluir.');
    }
    await this.prisma.supplier.delete({ where: { id } });
    return { success: true };
  }

  // RF-02 e RF-03: grava a compra e dá entrada no estoque na mesma transação.
  async createPurchase(dto: CreatePurchaseDto) {
    const today = this.today();
    const purchasedAt = dto.purchasedAt !== undefined ? parseDay(dto.purchasedAt).startsAt : today;
    const dueDate = parseDay(dto.dueDate).startsAt;
    assertPurchaseDates(purchasedAt, dueDate, today);
    assertItemCount(dto.items.length);
    const lines = dto.items.map((item) => ({
      ingredientId: item.ingredientId,
      quantityMilli: positiveMilli(item.quantity),
      unitCostCents: positiveCents(item.unitCost),
    }));

    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: dto.supplierId } });
      if (!supplier) throw new NotFoundException('Fornecedor não encontrado.');
      if (!supplier.active) throw new BadRequestException(`O fornecedor ${supplier.name} está inativo.`);

      const ids = lines.map((line) => line.ingredientId);
      const ingredients = new Map(
        (await tx.ingredient.findMany({ where: { id: { in: ids } } })).map((ingredient) => [ingredient.id, ingredient]),
      );
      const missing = ids.find((id) => !ingredients.has(id));
      if (missing !== undefined) throw new NotFoundException(`Ingrediente ${missing} não encontrado.`);
      assertNoDuplicateIngredients(ids, (id) => ingredients.get(id)!.name, 'na compra');

      const purchase = await tx.purchase.create({
        data: {
          supplierId: supplier.id,
          invoiceNumber: dto.invoiceNumber?.trim() || null,
          purchasedAt,
          dueDate,
          notes: dto.notes?.trim() || null,
          total: centsToDecimal(purchaseTotalCents(lines)),
          items: {
            create: lines.map((line) => {
              const ingredient = ingredients.get(line.ingredientId)!;
              return {
                ingredientId: ingredient.id,
                ingredientName: ingredient.name,
                unit: ingredient.unit,
                quantity: fromMilli(line.quantityMilli),
                unitCost: centsToDecimal(line.unitCostCents),
                total: centsToDecimal(lineTotalCents(line.quantityMilli, line.unitCostCents)),
              };
            }),
          },
        },
      });

      for (const line of [...lines].sort((a, b) => a.ingredientId - b.ingredientId)) {
        await recordMovement(tx, {
          ingredientId: line.ingredientId,
          type: 'PURCHASE',
          deltaMilli: line.quantityMilli,
          purchaseId: purchase.id,
          note: `Compra #${purchase.id} - ${supplier.name}`,
        });
      }
      return tx.purchase.findUniqueOrThrow({ where: { id: purchase.id }, include: purchaseInclude });
    });
  }

  // RF-04
  listPurchases(filters: { supplierId?: number; status?: PurchaseStatus } = {}) {
    return this.prisma.purchase.findMany({
      where: {
        ...(filters.supplierId !== undefined ? { supplierId: filters.supplierId } : {}),
        ...(filters.status !== undefined ? { status: filters.status } : {}),
      },
      orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }],
      include: { supplier: true },
    });
  }

  async getPurchase(id: number) {
    const purchase = await this.prisma.purchase.findUnique({ where: { id }, include: purchaseInclude });
    if (!purchase) throw new NotFoundException('Compra não encontrada.');
    return purchase;
  }

  // RF-05, RN-08, RN-10 e RN-11: o pagamento vira despesa na data do pagamento.
  async payPurchase(id: number, dto: PayPurchaseDto) {
    const today = this.today();
    const paidAt = dto.paidAt !== undefined ? parseDay(dto.paidAt).startsAt : today;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Purchase" WHERE "id" = ${id} FOR UPDATE`;
      const purchase = await tx.purchase.findUnique({ where: { id }, include: { supplier: true } });
      if (!purchase) throw new NotFoundException('Compra não encontrada.');
      assertOpen(purchase.status);
      assertPaymentDate(paidAt, purchase.purchasedAt, today);

      const expense = await tx.expense.create({
        data: {
          description: `Compra #${id} - ${purchase.supplier.name}`.slice(0, 160),
          amount: purchase.total,
          incurredAt: paidAt,
        },
      });
      await tx.purchase.update({
        where: { id },
        data: { status: 'PAID', paymentMethod: dto.paymentMethod, paidAt, expenseId: expense.id },
      });
      return tx.purchase.findUniqueOrThrow({ where: { id }, include: purchaseInclude });
    });
  }

  // RF-06, RN-08 e RN-09: estorna as entradas, se o estoque ainda as cobre.
  async cancelPurchase(id: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Purchase" WHERE "id" = ${id} FOR UPDATE`;
      const purchase = await tx.purchase.findUnique({ where: { id }, include: { items: true } });
      if (!purchase) throw new NotFoundException('Compra não encontrada.');
      assertOpen(purchase.status);

      const items = purchase.items
        .flatMap((item) => (item.ingredientId === null ? [] : [{ ...item, ingredientId: item.ingredientId }]))
        .sort((a, b) => a.ingredientId - b.ingredientId);
      if (items.length) {
        const ids = items.map((item) => item.ingredientId);
        await tx.$queryRaw`SELECT "id" FROM "Ingredient" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`;
        const stock = new Map(
          (await tx.ingredient.findMany({ where: { id: { in: ids } } })).map((ingredient) => [ingredient.id, ingredient]),
        );
        for (const item of items) {
          assertCanReverse(toMilli(stock.get(item.ingredientId)!.quantity), toMilli(item.quantity), item.ingredientName);
        }
        for (const item of items) {
          await recordMovement(tx, {
            ingredientId: item.ingredientId,
            type: 'ADJUSTMENT',
            deltaMilli: -toMilli(item.quantity),
            purchaseId: id,
            note: `Cancelamento da compra #${id}`,
          });
        }
      }
      await tx.purchase.update({ where: { id }, data: { status: 'CANCELLED' } });
      return tx.purchase.findUniqueOrThrow({ where: { id }, include: purchaseInclude });
    });
  }

  // RF-07 e RN-07
  async payables() {
    const today = this.today();
    const open = await this.prisma.purchase.findMany({
      where: { status: 'OPEN' },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      include: { supplier: true },
    });
    const summary = summarizePayables(
      open.map((purchase) => ({ dueDate: purchase.dueDate, totalCents: decimalToCents(purchase.total) })),
      today,
    );
    return {
      today: today.toISOString().slice(0, 10),
      summary: {
        count: summary.count,
        open: centsToDecimal(summary.openCents),
        overdue: centsToDecimal(summary.overdueCents),
        dueNext7Days: centsToDecimal(summary.dueNext7DaysCents),
      },
      payables: open.map((purchase) => ({ ...purchase, situation: payableSituation(purchase.dueDate, today) })),
    };
  }

  private today() {
    return startOfUtcDay(this.now());
  }

  // RN-01
  private async assertSupplierNameFree(name: string, ignoreId?: number) {
    const same = await this.prisma.supplier.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...(ignoreId !== undefined ? { id: { not: ignoreId } } : {}) },
    });
    if (same) throw new BadRequestException(`Já existe um fornecedor chamado ${same.name}.`);
  }
}
