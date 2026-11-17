import { Prisma } from '@prisma/client';
import { QUEUE_STATUSES } from './kitchen-rules';

type Db = Pick<Prisma.TransactionClient, 'kitchenTicket'>;

// RN-08: ao cancelar a comanda, o que ainda não foi entregue sai da fila.
export function cancelPendingTickets(db: Db, orderId: number, at: Date) {
  return db.kitchenTicket.updateMany({
    where: { orderId, status: { in: [...QUEUE_STATUSES] } },
    data: { status: 'CANCELLED', cancelledAt: at },
  });
}

// RN-09: na junção, os pedidos de cozinha da origem vão para o destino.
export function moveTickets(db: Db, fromOrderId: number, toOrderId: number) {
  return db.kitchenTicket.updateMany({ where: { orderId: fromOrderId }, data: { orderId: toOrderId } });
}
