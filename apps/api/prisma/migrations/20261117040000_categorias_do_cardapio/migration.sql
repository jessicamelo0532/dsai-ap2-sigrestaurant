-- Categorias do cardápio (SPEC/2026-11-16-categorias-do-cardapio.md)
ALTER TABLE "MenuItem" ADD COLUMN "categoryId" INTEGER;

CREATE TABLE "MenuCategory" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "nameKey" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MenuCategory_nameKey_key" ON "MenuCategory"("nameKey");
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
