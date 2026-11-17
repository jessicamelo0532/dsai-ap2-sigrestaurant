-- Metas de vendas (SPEC/2026-11-16-metas-de-vendas.md)
CREATE TABLE "SalesGoal" (
  "id" SERIAL NOT NULL,
  "month" TEXT NOT NULL,
  "revenue" DECIMAL(12,2),
  "orders" INTEGER,
  "averageTicket" DECIMAL(10,2),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesGoal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesGoal_month_key" ON "SalesGoal"("month");
