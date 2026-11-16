-- Programa de fidelidade (SPEC/2026-11-16-programa-de-fidelidade.md)
CREATE TYPE "LoyaltyEntryType" AS ENUM ('EARN', 'REDEEM', 'REFUND');

ALTER TABLE "Order" ADD COLUMN "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "LoyaltySettings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "pointsPerReal" INTEGER NOT NULL,
  "centsPerPoint" INTEGER NOT NULL,
  "minRedeemPoints" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoyaltySettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyEntry" (
  "id" SERIAL NOT NULL,
  "customerId" INTEGER NOT NULL,
  "orderId" INTEGER,
  "type" "LoyaltyEntryType" NOT NULL,
  "points" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoyaltyEntry_customerId_createdAt_idx" ON "LoyaltyEntry"("customerId", "createdAt");
CREATE INDEX "LoyaltyEntry_orderId_idx" ON "LoyaltyEntry"("orderId");

ALTER TABLE "LoyaltyEntry" ADD CONSTRAINT "LoyaltyEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoyaltyEntry" ADD CONSTRAINT "LoyaltyEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
