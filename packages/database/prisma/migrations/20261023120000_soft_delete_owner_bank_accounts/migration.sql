-- AlterTable
ALTER TABLE "owner_bank_accounts" ADD COLUMN     "isRemoved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "removedAt" TIMESTAMP(3);
