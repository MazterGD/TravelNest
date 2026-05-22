-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'REGISTRATION', 'PHONE_VERIFICATION');

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "businessName" TEXT,
  ADD COLUMN "businessType" TEXT,
  ADD COLUMN "businessRegNumber" TEXT,
  ADD COLUMN "tinNumber" TEXT;

-- CreateTable
CREATE TABLE "otp_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "code" TEXT NOT NULL,
  "purpose" "OtpPurpose" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "otp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "repliedAt" TIMESTAMP(3),
  "repliedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_tokens_phone_purpose_idx" ON "otp_tokens"("phone", "purpose");

-- CreateIndex
CREATE INDEX "otp_tokens_email_purpose_idx" ON "otp_tokens"("email", "purpose");

-- CreateIndex
CREATE INDEX "otp_tokens_userId_idx" ON "otp_tokens"("userId");

-- CreateIndex
CREATE INDEX "otp_tokens_expiresAt_idx" ON "otp_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "contact_messages_referenceId_key" ON "contact_messages"("referenceId");

-- CreateIndex
CREATE INDEX "contact_messages_isRead_idx" ON "contact_messages"("isRead");

-- CreateIndex
CREATE INDEX "contact_messages_createdAt_idx" ON "contact_messages"("createdAt");

-- AddForeignKey
ALTER TABLE "otp_tokens"
  ADD CONSTRAINT "otp_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_messages"
  ADD CONSTRAINT "contact_messages_repliedBy_fkey"
  FOREIGN KEY ("repliedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
