/*
  Warnings:

  - The values [BUSINESS_REGISTRATION] on the enum `DocumentType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `business_profiles` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DocumentType_new" AS ENUM ('NIC', 'DRIVING_LICENSE', 'INSURANCE', 'REGISTRATION_CERTIFICATE', 'PROFILE_PHOTO', 'VEHICLE_PHOTO');
ALTER TABLE "owner_documents" ALTER COLUMN "type" TYPE "DocumentType_new" USING ("type"::text::"DocumentType_new");
ALTER TABLE "vehicle_documents" ALTER COLUMN "type" TYPE "DocumentType_new" USING ("type"::text::"DocumentType_new");
ALTER TYPE "DocumentType" RENAME TO "DocumentType_old";
ALTER TYPE "DocumentType_new" RENAME TO "DocumentType";
DROP TYPE "public"."DocumentType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "business_profiles" DROP CONSTRAINT "business_profiles_ownerId_fkey";

-- DropTable
DROP TABLE "business_profiles";
