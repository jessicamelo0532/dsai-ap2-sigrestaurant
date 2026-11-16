-- Cozinha: envio, fila de produção e prioridade (SPEC/2026-11-16-cozinha-kds.md)
CREATE TYPE "KitchenTicketStatus" AS ENUM ('QUEUED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED');
CREATE TYPE "KitchenPriority" AS ENUM ('NORMAL', 'HIGH');

ALTER TABLE "OrderItem" ADD COLUMN "ticketId" INTEGER;

CREATE TABLE "KitchenTicket" (
  "id" SERIAL NOT NULL,
  "orderId" INTEGER NOT NULL,
  "status" "KitchenTicketStatus" NOT NULL DEFAULT 'QUEUED',
  "priority" "KitchenPriority" NOT NULL DEFAULT 'NORMAL',
  "note" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "readyAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "KitchenTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KitchenPriorityChange" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "from" "KitchenPriority" NOT NULL,
  "to" "KitchenPriority" NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KitchenPriorityChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderItem_ticketId_idx" ON "OrderItem"("ticketId");
CREATE INDEX "KitchenTicket_status_sentAt_idx" ON "KitchenTicket"("status", "sentAt");
CREATE INDEX "KitchenTicket_orderId_idx" ON "KitchenTicket"("orderId");
CREATE INDEX "KitchenPriorityChange_ticketId_idx" ON "KitchenPriorityChange"("ticketId");

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "KitchenTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KitchenPriorityChange" ADD CONSTRAINT "KitchenPriorityChange_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "KitchenTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
