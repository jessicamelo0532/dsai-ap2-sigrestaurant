-- Zonas do salão (SPEC/2026-11-17-zonas-do-salao.md)
-- A coluna "zoneId" é obrigatória, então a zona padrão (P-1: "Salão") é criada antes
-- e recebe todas as mesas que já existem (RNF-01: nenhuma mesa fica sem zona).

-- CreateTable
CREATE TABLE "Zone" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zone_name_key" ON "Zone"("name");

-- Zona padrão (RN-04)
INSERT INTO "Zone" ("name", "sortOrder") VALUES ('Salão', 1);

-- AlterTable: entra opcional, recebe a zona padrão e passa a ser obrigatória
ALTER TABLE "DiningTable" ADD COLUMN "zoneId" INTEGER;
UPDATE "DiningTable" SET "zoneId" = (SELECT "id" FROM "Zone" WHERE "name" = 'Salão');
ALTER TABLE "DiningTable" ALTER COLUMN "zoneId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "DiningTable_zoneId_idx" ON "DiningTable"("zoneId");

-- AddForeignKey
ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
