-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "tripPackageId" TEXT;

-- CreateTable
CREATE TABLE "trip_packages" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startLocation" TEXT NOT NULL,
    "endLocation" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "minPassengers" INTEGER NOT NULL,
    "maxPassengers" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_packages_ownerId_idx" ON "trip_packages"("ownerId");

-- CreateIndex
CREATE INDEX "trip_packages_vehicleId_idx" ON "trip_packages"("vehicleId");

-- CreateIndex
CREATE INDEX "trip_packages_startLocation_idx" ON "trip_packages"("startLocation");

-- CreateIndex
CREATE INDEX "trip_packages_endLocation_idx" ON "trip_packages"("endLocation");

-- CreateIndex
CREATE INDEX "bookings_tripPackageId_idx" ON "bookings"("tripPackageId");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tripPackageId_fkey" FOREIGN KEY ("tripPackageId") REFERENCES "trip_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_packages" ADD CONSTRAINT "trip_packages_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_packages" ADD CONSTRAINT "trip_packages_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
