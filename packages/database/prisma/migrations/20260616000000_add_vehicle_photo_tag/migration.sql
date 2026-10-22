-- CreateEnum
CREATE TYPE "VehiclePhotoTag" AS ENUM ('EXTERIOR', 'INTERIOR', 'FRONT', 'REAR', 'SEATS', 'OTHER');

-- AlterTable
ALTER TABLE "vehicle_photos" ADD COLUMN "tag" "VehiclePhotoTag" NOT NULL DEFAULT 'EXTERIOR';
