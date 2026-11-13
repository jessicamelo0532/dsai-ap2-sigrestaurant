-- Estoque de ingredientes (SPEC/2026-11-13-estoque-de-ingredientes.md)
CREATE TYPE "StockUnit" AS ENUM ('UN', 'KG', 'G', 'L', 'ML');
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'LOSS', 'ADJUSTMENT', 'SALE');

CREATE TABLE "Ingredient" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "unit" "StockUnit" NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "minimumQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

CREATE TABLE "RecipeItem" (
  "id" SERIAL NOT NULL,
  "menuItemId" INTEGER NOT NULL,
  "ingredientId" INTEGER NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecipeItem_menuItemId_ingredientId_key" ON "RecipeItem"("menuItemId", "ingredientId");
CREATE INDEX "RecipeItem_ingredientId_idx" ON "RecipeItem"("ingredientId");

CREATE TABLE "StockMovement" (
  "id" SERIAL NOT NULL,
  "ingredientId" INTEGER NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "orderId" INTEGER,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockMovement_ingredientId_createdAt_idx" ON "StockMovement"("ingredientId", "createdAt");
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
