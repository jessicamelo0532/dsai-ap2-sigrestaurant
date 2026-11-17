-- Fechamento mensal (SPEC/2026-11-16-fechamento-mensal.md)
CREATE TYPE "ClosingStatus" AS ENUM ('CLOSED', 'REOPENED');

CREATE TABLE "MonthlyClosing" (
  "id" SERIAL NOT NULL,
  "month" TEXT NOT NULL,
  "status" "ClosingStatus" NOT NULL DEFAULT 'CLOSED',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "revenue" DECIMAL(12,2) NOT NULL,
  "cash" DECIMAL(12,2) NOT NULL,
  "credit" DECIMAL(12,2) NOT NULL,
  "debit" DECIMAL(12,2) NOT NULL,
  "pix" DECIMAL(12,2) NOT NULL,
  "purchases" DECIMAL(12,2) NOT NULL,
  "otherExpenses" DECIMAL(12,2) NOT NULL,
  "result" DECIMAL(12,2) NOT NULL,
  "paidOrders" INTEGER NOT NULL,
  "averageTicket" DECIMAL(12,2) NOT NULL,
  "notes" TEXT,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reopenedAt" TIMESTAMP(3),
  "reopenReason" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonthlyClosing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MonthlyClosing_month_key" ON "MonthlyClosing"("month");
