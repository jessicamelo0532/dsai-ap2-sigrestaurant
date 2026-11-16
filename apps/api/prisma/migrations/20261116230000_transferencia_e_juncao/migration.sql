-- Transferência e junção de comandas (SPEC/2026-11-16-transferencia-e-juncao-de-comandas.md)
ALTER TYPE "OrderStatus" ADD VALUE 'MERGED';
CREATE TYPE "OrderEventType" AS ENUM ('TRANSFER', 'MERGE');

ALTER TABLE "Order" ADD COLUMN "mergedIntoId" INTEGER;

CREATE TABLE "OrderEvent" (
  "id" SERIAL NOT NULL,
  "orderId" INTEGER NOT NULL,
  "type" "OrderEventType" NOT NULL,
  "fromTableNumber" INTEGER,
  "toTableNumber" INTEGER,
  "sourceOrderId" INTEGER,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderEvent_orderId_idx" ON "OrderEvent"("orderId");

ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
