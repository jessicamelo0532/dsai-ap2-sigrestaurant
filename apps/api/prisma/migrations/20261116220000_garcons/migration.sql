-- Garçons e comissão (SPEC/2026-11-16-garcons-e-comissao.md)
CREATE TABLE "Waiter" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 10,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Waiter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Waiter_name_key" ON "Waiter"("name");

ALTER TABLE "Order" ADD COLUMN "waiterId" INTEGER;
ALTER TABLE "Order" ADD COLUMN "waiterName" TEXT;
ALTER TABLE "Order" ADD COLUMN "commissionRate" DECIMAL(5,2);
CREATE INDEX "Order_waiterId_idx" ON "Order"("waiterId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "Waiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
