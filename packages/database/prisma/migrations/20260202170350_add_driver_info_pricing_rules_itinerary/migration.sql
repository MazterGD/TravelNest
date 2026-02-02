/*
  Warnings:

  - You are about to drop the column `stripeCustomerId` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `stripePaymentId` on the `payments` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[payherePaymentId]` on the table `payments` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "payments_stripePaymentId_key";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "driverLicense" TEXT,
ADD COLUMN     "driverName" TEXT,
ADD COLUMN     "driverPhone" TEXT,
ADD COLUMN     "estimatedDistance" TEXT,
ADD COLUMN     "estimatedDuration" TEXT;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripePaymentId",
ADD COLUMN     "payhereCustomerId" TEXT,
ADD COLUMN     "payherePaymentId" TEXT;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "fuelCostPerKm" DOUBLE PRECISION,
ADD COLUMN     "minBookingHours" INTEGER,
ADD COLUMN     "minBookingKm" INTEGER;

-- CreateTable
CREATE TABLE "trip_itineraries" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startLocation" TEXT NOT NULL,
    "endLocation" TEXT NOT NULL,
    "overnightStop" TEXT,
    "description" TEXT,
    "estimatedKm" INTEGER,
    "pickupPoints" JSONB,
    "dropoffPoints" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_itineraries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_itineraries_bookingId_idx" ON "trip_itineraries"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "trip_itineraries_bookingId_dayNumber_key" ON "trip_itineraries"("bookingId", "dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_payherePaymentId_key" ON "payments"("payherePaymentId");

-- AddForeignKey
ALTER TABLE "trip_itineraries" ADD CONSTRAINT "trip_itineraries_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
