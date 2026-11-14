-- Reservas de mesa (SPEC/2026-11-12-reservas-de-mesa.md)
CREATE TYPE "ReservationStatus" AS ENUM ('BOOKED', 'SEATED', 'CANCELLED', 'NO_SHOW');

CREATE TABLE "Reservation" (
  "id" SERIAL NOT NULL,
  "tableId" INTEGER,
  "tableNumber" INTEGER NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT,
  "partySize" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "ReservationStatus" NOT NULL DEFAULT 'BOOKED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Reservation_tableId_startsAt_idx" ON "Reservation"("tableId", "startsAt");
CREATE INDEX "Reservation_startsAt_idx" ON "Reservation"("startsAt");

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
