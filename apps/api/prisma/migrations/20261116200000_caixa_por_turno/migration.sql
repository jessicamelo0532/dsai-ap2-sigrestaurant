-- Caixa por turno (SPEC/2026-11-16-caixa-por-turno.md)
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "CashMovementType" AS ENUM ('WITHDRAWAL', 'DEPOSIT');

CREATE TABLE "CashSession" (
  "id" SERIAL NOT NULL,
  "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
  "openedBy" TEXT NOT NULL,
  "openingAmount" DECIMAL(10,2) NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL,
  "closedBy" TEXT,
  "closedAt" TIMESTAMP(3),
  "expectedCash" DECIMAL(10,2),
  "expectedCredit" DECIMAL(10,2),
  "expectedDebit" DECIMAL(10,2),
  "expectedPix" DECIMAL(10,2),
  "countedCash" DECIMAL(10,2),
  "countedCredit" DECIMAL(10,2),
  "countedDebit" DECIMAL(10,2),
  "countedPix" DECIMAL(10,2),
  "notes" TEXT,
  CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CashSession_status_idx" ON "CashSession"("status");
CREATE INDEX "CashSession_openedAt_idx" ON "CashSession"("openedAt");

CREATE TABLE "CashMovement" (
  "id" SERIAL NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "type" "CashMovementType" NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CashMovement_sessionId_idx" ON "CashMovement"("sessionId");

ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CashSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
