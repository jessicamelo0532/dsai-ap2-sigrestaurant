-- Disponibilidade do cardápio por horário (SPEC/2026-11-16-cardapio-por-horario.md)
CREATE TABLE "MenuAvailability" (
  "id" SERIAL NOT NULL,
  "menuItemId" INTEGER NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  CONSTRAINT "MenuAvailability_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MenuAvailability_menuItemId_idx" ON "MenuAvailability"("menuItemId");

ALTER TABLE "MenuAvailability" ADD CONSTRAINT "MenuAvailability_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
