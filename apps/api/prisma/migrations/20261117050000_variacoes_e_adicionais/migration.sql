-- Variações e adicionais (SPEC/2026-11-16-variacoes-e-adicionais.md)
ALTER TABLE "OrderItem" ADD COLUMN "variantName" TEXT;

CREATE TABLE "MenuVariant" (
  "id" SERIAL NOT NULL,
  "menuItemId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "MenuVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuAddon" (
  "id" SERIAL NOT NULL,
  "menuItemId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "MenuAddon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItemAddon" (
  "id" SERIAL NOT NULL,
  "orderItemId" INTEGER NOT NULL,
  "nameSnapshot" TEXT NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "OrderItemAddon_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MenuVariant_menuItemId_idx" ON "MenuVariant"("menuItemId");
CREATE INDEX "MenuAddon_menuItemId_idx" ON "MenuAddon"("menuItemId");
CREATE INDEX "OrderItemAddon_orderItemId_idx" ON "OrderItemAddon"("orderItemId");

ALTER TABLE "MenuVariant" ADD CONSTRAINT "MenuVariant_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuAddon" ADD CONSTRAINT "MenuAddon_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItemAddon" ADD CONSTRAINT "OrderItemAddon_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
