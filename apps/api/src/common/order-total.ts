// Total da comanda num lugar só (SPEC/2026-11-16-programa-de-fidelidade.md, RF-06).
// Total = soma dos itens (preço guardado × quantidade) menos o desconto de fidelidade
// mais a taxa de entrega (SPEC/2026-11-16-delivery.md, RF-03).

type Money = { toString(): string } | number | string;

export interface TotalSource {
  discount?: Money | null;
  deliveryFee?: Money | null;
  items: readonly { quantity: number; unitPrice: Money }[];
}

// Campos que as consultas precisam pedir ao banco para calcular o total.
export const orderTotalSelect = {
  discount: true,
  deliveryFee: true,
  items: { select: { quantity: true, unitPrice: true } },
} as const;

export function toCents(value: Money | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Math.round(Number(value.toString()) * 100);
}

export function subtotalCents(order: Pick<TotalSource, 'items'>): number {
  return order.items.reduce((sum, line) => sum + toCents(line.unitPrice) * line.quantity, 0);
}

export function discountCents(order: Pick<TotalSource, 'discount'>): number {
  return toCents(order.discount);
}

export function deliveryFeeCents(order: Pick<TotalSource, 'deliveryFee'>): number {
  return toCents(order.deliveryFee);
}

export function orderTotalCents(order: TotalSource): number {
  return subtotalCents(order) - discountCents(order) + deliveryFeeCents(order);
}
