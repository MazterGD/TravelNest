/*
  Warnings:

  - The values [RESPONDED] on the enum `QuotationStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `ownerMessage` on the `quotations` table. All the data in the column will be lost.
  - You are about to drop the column `quotedPrice` on the `quotations` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[quotationId]` on the table `quotations` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `quotationId` to the `quotations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "QuotationStatus_new" AS ENUM ('PENDING', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED');
ALTER TABLE "public"."quotations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "quotations" ALTER COLUMN "status" TYPE "QuotationStatus_new" USING ("status"::text::"QuotationStatus_new");
ALTER TYPE "QuotationStatus" RENAME TO "QuotationStatus_old";
ALTER TYPE "QuotationStatus_new" RENAME TO "QuotationStatus";
DROP TYPE "public"."QuotationStatus_old";
ALTER TABLE "quotations" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "quotations" DROP COLUMN "ownerMessage",
DROP COLUMN "quotedPrice",
ADD COLUMN     "additionalNotes" TEXT,
ADD COLUMN     "customItems" JSONB,
ADD COLUMN     "driverCost" DOUBLE PRECISION,
ADD COLUMN     "estimatedDistance" TEXT,
ADD COLUMN     "estimatedDuration" TEXT,
ADD COLUMN     "fuelCost" DOUBLE PRECISION,
ADD COLUMN     "permitFees" DOUBLE PRECISION,
ADD COLUMN     "quotationId" TEXT NOT NULL,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "startTime" TEXT,
ADD COLUMN     "subtotal" DOUBLE PRECISION,
ADD COLUMN     "tax" DOUBLE PRECISION,
ADD COLUMN     "tollCharges" DOUBLE PRECISION,
ADD COLUMN     "totalAmount" DOUBLE PRECISION,
ADD COLUMN     "validityDays" INTEGER,
ADD COLUMN     "vehicleRentalCost" DOUBLE PRECISION,
ADD COLUMN     "viewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "quotations_quotationId_key" ON "quotations"("quotationId");

-- CreateIndex
CREATE INDEX "quotations_quotationId_idx" ON "quotations"("quotationId");
