import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { closedMonthMessage, monthOf } from './closing-rules';

// RN-07 da SPEC/2026-11-16-fechamento-mensal.md: recusa lançamento com data num mês fechado.
// Usada pelas despesas (AppService) e pelo pagamento de compras (PurchasingService).
export async function assertMonthsOpen(
  db: Pick<Prisma.TransactionClient, 'monthlyClosing'>,
  ...dates: Date[]
): Promise<void> {
  const months = [...new Set(dates.map(monthOf))];
  const closed = await db.monthlyClosing.findFirst({
    where: { month: { in: months }, status: 'CLOSED' },
    orderBy: { month: 'asc' },
  });
  if (closed) throw new BadRequestException(closedMonthMessage(closed.month));
}
