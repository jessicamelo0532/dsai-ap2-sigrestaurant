import { Prisma } from '@prisma/client';
import { subtotalCents, TotalSource, toCents, orderTotalCents } from '../common/order-total';
import { assertDiscountFits, DEFAULT_RULE, LoyaltyRule, pointsEarned } from './loyalty-rules';

// Operações do extrato usadas dentro das transações da comanda (SPEC/2026-11-16-programa-de-fidelidade.md).
type Db = Prisma.TransactionClient;

export async function loadRule(db: Pick<Db, 'loyaltySettings'>): Promise<LoyaltyRule> {
  const row = await db.loyaltySettings.findUnique({ where: { id: 1 } });
  return row ? { pointsPerReal: row.pointsPerReal, centsPerPoint: row.centsPerPoint, minRedeemPoints: row.minRedeemPoints } : DEFAULT_RULE;
}

// RNF-01
export async function lockCustomer(db: Pick<Db, '$queryRaw'>, customerId: number) {
  await db.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${customerId} FOR UPDATE`;
}

// RNF-02: o saldo é a soma do extrato.
export async function balanceOf(db: Pick<Db, 'loyaltyEntry'>, customerId: number) {
  const sum = await db.loyaltyEntry.aggregate({ where: { customerId }, _sum: { points: true } });
  return sum._sum.points ?? 0;
}

// RF-02 e RN-02: crédito no pagamento, pela regra do momento.
export async function creditPayment(db: Db, order: TotalSource & { id: number; customerId: number | null }) {
  if (order.customerId === null) return 0;
  const points = pointsEarned(orderTotalCents(order), await loadRule(db));
  if (!points) return 0;
  await lockCustomer(db, order.customerId);
  await db.loyaltyEntry.create({ data: { customerId: order.customerId, orderId: order.id, type: 'EARN', points } });
  return points;
}

// RF-04 e RN-08: devolve os pontos e tira o desconto.
export async function refundRedemption(db: Db, order: { id: number; customerId: number | null; loyaltyPoints: number }) {
  if (order.loyaltyPoints <= 0 || order.customerId === null) return 0;
  await lockCustomer(db, order.customerId);
  await db.loyaltyEntry.create({ data: { customerId: order.customerId, orderId: order.id, type: 'REFUND', points: order.loyaltyPoints } });
  await db.order.update({ where: { id: order.id }, data: { discount: 0, loyaltyPoints: 0 } });
  return order.loyaltyPoints;
}

// RN-07: com resgate, a mudança no item não pode deixar o subtotal abaixo do desconto.
export async function assertItemChangeFits(
  db: Pick<Db, 'orderItem'>,
  order: { id: number; discount: Prisma.Decimal | number | string; loyaltyPoints: number },
  itemId: number,
  newQuantity: number,
) {
  if (order.loyaltyPoints <= 0) return;
  const items = await db.orderItem.findMany({ where: { orderId: order.id }, select: { id: true, quantity: true, unitPrice: true } });
  const changed = items.map((item) => (item.id === itemId ? { ...item, quantity: newQuantity } : item));
  assertDiscountFits(subtotalCents({ items: changed }), toCents(order.discount));
}
