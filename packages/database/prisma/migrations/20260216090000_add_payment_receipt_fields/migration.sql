-- AlterTable
ALTER TABLE "payments"
  ADD COLUMN "bankReceiptUrl" TEXT,
  ADD COLUMN "bankReceiptName" TEXT,
  ADD COLUMN "bankReceiptSize" INTEGER,
  ADD COLUMN "bankReceiptMime" TEXT,
  ADD COLUMN "bankReceiptAt" TIMESTAMP(3);
