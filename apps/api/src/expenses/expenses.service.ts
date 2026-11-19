import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertMonthsOpen } from '../closings/closing-guard';
import { CreateExpenseDto, UpdateExpenseDto } from '../dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ExpensesService {
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
}
