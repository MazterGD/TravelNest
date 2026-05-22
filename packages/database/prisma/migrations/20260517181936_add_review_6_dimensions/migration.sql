-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "isRecommended" BOOLEAN,
ADD COLUMN     "ratingCleanliness" INTEGER,
ADD COLUMN     "ratingDriverBehavior" INTEGER,
ADD COLUMN     "ratingPunctuality" INTEGER,
ADD COLUMN     "ratingValueForMoney" INTEGER,
ADD COLUMN     "ratingVehicleCondition" INTEGER,
ADD COLUMN     "title" TEXT;
