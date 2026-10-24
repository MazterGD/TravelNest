-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "requiredAmenities" TEXT[] DEFAULT ARRAY[]::TEXT[];
