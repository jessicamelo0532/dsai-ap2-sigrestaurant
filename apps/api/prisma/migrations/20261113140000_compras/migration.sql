-- Fornecedores, compras e contas a pagar (SPEC/2026-11-13-fornecedores-e-contas-a-pagar.md)
CREATE TYPE "PurchaseStatus" AS ENUM ('OPEN', 'PAID', 'CANCELLED');

CREATE TABLE "Supplier" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "document" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

CREATE TABLE "Purchase" (
  "id" SERIAL NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "invoiceNumber" TEXT,
  "purchasedAt" DATE NOT NULL,
  "dueDate" DATE NOT NULL,
  "total" DECIMAL(10,2) NOT NULL,
  "status" "PurchaseStatus" NOT NULL DEFAULT 'OPEN',
  "paymentMethod" "PaymentMethod",
  "paidAt" DATE,
  "expenseId" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Purchase_expenseId_key" ON "Purchase"("expenseId");
CREATE INDEX "Purchase_status_dueDate_idx" ON "Purchase"("status", "dueDate");
CREATE INDEX "Purchase_supplierId_idx" ON "Purchase"("supplierId");

CREATE TABLE "PurchaseItem" (
  "id" SERIAL NOT NULL,
  "purchaseId" INTEGER NOT NULL,
  "ingredientId" INTEGER,
  "ingredientName" TEXT NOT NULL,
  "unit" "StockUnit" NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "unitCost" DECIMAL(10,2) NOT NULL,
  "total" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");
CREATE INDEX "PurchaseItem_ingredientId_idx" ON "PurchaseItem"("ingredientId");

ALTER TABLE "StockMovement" ADD COLUMN "purchaseId" INTEGER;
CREATE INDEX "StockMovement_purchaseId_idx" ON "StockMovement"("purchaseId");

ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
