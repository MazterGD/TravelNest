-- AlterTable
ALTER TABLE "vehicle_availability" ADD COLUMN     "isRemoved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3);
