-- Clientes e histórico de consumo (SPEC/2026-11-16-clientes-e-historico.md)
ALTER TABLE "Order" ADD COLUMN "customerId" INTEGER;

CREATE TABLE "Customer" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "nameKey" TEXT NOT NULL,
  "phone" TEXT,
  "notes" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Customer_dedupeKey_key" ON "Customer"("dedupeKey");
CREATE INDEX "Customer_nameKey_idx" ON "Customer"("nameKey");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
