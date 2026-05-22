-- CreateTable
CREATE TABLE "owner_bank_accounts" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankCode" TEXT,
    "branchName" TEXT,
    "branchCode" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owner_bank_accounts_ownerId_idx" ON "owner_bank_accounts"("ownerId");

-- AddForeignKey
ALTER TABLE "owner_bank_accounts" ADD CONSTRAINT "owner_bank_accounts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
