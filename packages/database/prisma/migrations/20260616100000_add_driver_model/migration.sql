-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "photoUrl" TEXT,
    "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add driverId FK to bookings
ALTER TABLE "bookings" ADD COLUMN "driverId" TEXT;

-- CreateIndex
CREATE INDEX "drivers_ownerId_idx" ON "drivers"("ownerId");
CREATE INDEX "drivers_status_idx" ON "drivers"("status");
CREATE INDEX "bookings_driverId_idx" ON "bookings"("driverId");
CREATE INDEX "bookings_driverId_startDate_endDate_idx" ON "bookings"("driverId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
