-- Delivery (SPEC/2026-11-16-delivery.md)
CREATE TYPE "OrderChannel" AS ENUM ('DINE_IN', 'DELIVERY');
CREATE TYPE "DeliveryStatus" AS ENUM ('RECEIVED', 'OUT_FOR_DELIVERY', 'DELIVERED');

ALTER TABLE "Order" ADD COLUMN "channel" "OrderChannel" NOT NULL DEFAULT 'DINE_IN',
ADD COLUMN "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "recipient" TEXT,
ADD COLUMN "deliveryAddress" TEXT,
ADD COLUMN "deliveryPhone" TEXT,
ADD COLUMN "deliveryStatus" "DeliveryStatus",
ADD COLUMN "dispatchedAt" TIMESTAMP(3),
ADD COLUMN "deliveredAt" TIMESTAMP(3);

CREATE INDEX "Order_channel_status_idx" ON "Order"("channel", "status");
