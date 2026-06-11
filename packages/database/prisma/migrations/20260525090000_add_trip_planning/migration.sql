-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('PLANNING', 'AWAITING_QUOTES', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "tripCode" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT,
    "pickupLocation" TEXT NOT NULL,
    "pickupCity" TEXT,
    "pickupDistrict" TEXT,
    "pickupLatitude" DOUBLE PRECISION,
    "pickupLongitude" DOUBLE PRECISION,
    "dropoffLocation" TEXT,
    "dropoffCity" TEXT,
    "dropoffDistrict" TEXT,
    "dropoffLatitude" DOUBLE PRECISION,
    "dropoffLongitude" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "isRoundTrip" BOOLEAN NOT NULL DEFAULT false,
    "passengerCount" INTEGER NOT NULL,
    "vehicleTypePreference" "VehicleType",
    "needsAC" BOOLEAN NOT NULL DEFAULT true,
    "specialRequests" TEXT,
    "estimatedDistance" TEXT,
    "estimatedDuration" TEXT,
    "itineraryStops" JSONB,
    "itineraryRoute" JSONB,
    "intermediateStops" JSONB,
    "status" "TripStatus" NOT NULL DEFAULT 'PLANNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trips_tripCode_key" ON "trips"("tripCode");

-- CreateIndex
CREATE INDEX "trips_customerId_status_idx" ON "trips"("customerId", "status");

-- CreateIndex
CREATE INDEX "trips_startDate_idx" ON "trips"("startDate");

-- CreateIndex
CREATE INDEX "trips_tripCode_idx" ON "trips"("tripCode");

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: link Quotation rows to a Trip
ALTER TABLE "quotations" ADD COLUMN "tripId" TEXT;

-- CreateIndex
CREATE INDEX "quotations_tripId_idx" ON "quotations"("tripId");

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
