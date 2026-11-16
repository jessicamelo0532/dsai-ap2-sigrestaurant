import { BadRequestException } from '@nestjs/common';
import { averageTicketCents } from '../closings/closing-rules';

// Regras puras de garçons e comissão (SPEC/2026-11-16-garcons-e-comissao.md).
// Taxa de comissão em centésimos de ponto percentual: 10% = 1000, 12,5% = 1250.

export const DEFAULT_COMMISSION = 10;
export const MAX_COMMISSION = 30;
export const NO_WAITER = 'Sem garçom';
const RATE_MESSAGE = `Informe a comissão de 0 a ${MAX_COMMISSION}%, com até 2 casas decimais.`;

// RN-02
export function rateBasisPoints(value: number | string | { toString(): string }): number {
  const number = Number(typeof value === 'number' ? value : value.toString());
  const basisPoints = Math.round(number * 100);
  if (!Number.isFinite(number) || Math.abs(number * 100 - basisPoints) > 1e-6 || basisPoints < 0 || basisPoints > MAX_COMMISSION * 100) {
    throw new BadRequestException(RATE_MESSAGE);
  }
  return basisPoints;
}

export const basisPointsToDecimal = (basisPoints: number) =>
  `${Math.floor(basisPoints / 100)}.${String(basisPoints % 100).padStart(2, '0')}`;

// RN-05: comissão da comanda arredondada ao centavo.
export function commissionCents(revenueCents: number, basisPoints: number): number {
  return Math.round((revenueCents * basisPoints) / 10_000);
}

export type WaiterSale = { waiterId: number | null; waiterName: string | null; revenueCents: number; basisPoints: number };

// RN-05 a RN-07: agrupa por garçom (pelo nome guardado se o cadastro foi removido); "Sem garçom" por último.
export function waiterReport(sales: WaiterSale[]) {
  const groups = new Map<string, { waiterId: number | null; name: string; paidOrders: number; revenueCents: number; commissionCents: number }>();
  for (const sale of sales) {
    const key = sale.waiterId !== null ? `id:${sale.waiterId}` : sale.waiterName ? `nome:${sale.waiterName}` : 'sem';
    const group = groups.get(key)
      ?? { waiterId: sale.waiterId, name: sale.waiterName ?? NO_WAITER, paidOrders: 0, revenueCents: 0, commissionCents: 0 };
    group.paidOrders += 1;
    group.revenueCents += sale.revenueCents;
    group.commissionCents += key === 'sem' ? 0 : commissionCents(sale.revenueCents, sale.basisPoints);
    groups.set(key, group);
  }
  const rows = [...groups.entries()]
    .sort(([keyA, a], [keyB, b]) =>
      Number(keyA === 'sem') - Number(keyB === 'sem') || b.revenueCents - a.revenueCents || a.name.localeCompare(b.name, 'pt-BR'))
    .map(([, group]) => ({ ...group, averageTicketCents: averageTicketCents(group.revenueCents, group.paidOrders) }));
  return {
    waiters: rows,
    totals: {
      paidOrders: sales.length,
      revenueCents: rows.reduce((total, row) => total + row.revenueCents, 0),
      commissionCents: rows.reduce((total, row) => total + row.commissionCents, 0),
    },
  };
}
