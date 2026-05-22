-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM (
  'BOOKING_QUALITY_ISSUE',
  'CANCELLATION_DISPUTE',
  'PAYMENT_ISSUE',
  'VEHICLE_CONDITION',
  'BEHAVIOR_COMPLAINT',
  'SERVICE_NOT_PROVIDED',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "DisputePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('PERCENTAGE', 'FIXED', 'TIERED');

-- CreateTable
CREATE TABLE "disputes" (
  "id" TEXT NOT NULL,
  "disputeCode" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "raisedBy" TEXT NOT NULL,
  "raisedAgainst" TEXT NOT NULL,
  "type" "DisputeType" NOT NULL,
  "priority" "DisputePriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "assignedTo" TEXT,
  "proposedResolution" TEXT,
  "resolution" TEXT,
  "resolutionType" TEXT,
  "resolutionAmount" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),

  CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_messages" (
  "id" TEXT NOT NULL,
  "disputeId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isInternalNote" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "dispute_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
  "id" TEXT NOT NULL,
  "settlementCode" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "totalBookings" INTEGER NOT NULL,
  "grossAmount" DOUBLE PRECISION NOT NULL,
  "commissionAmount" DOUBLE PRECISION NOT NULL,
  "netAmount" DOUBLE PRECISION NOT NULL,
  "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
  "bankAccountName" TEXT,
  "bankAccountNumber" TEXT,
  "bankCode" TEXT,
  "processedBy" TEXT,
  "processedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_bookings" (
  "id" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "commission" DOUBLE PRECISION NOT NULL,
  "net" DOUBLE PRECISION NOT NULL,

  CONSTRAINT "settlement_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rules" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "CommissionType" NOT NULL,
  "percentage" DOUBLE PRECISION,
  "fixedAmount" DOUBLE PRECISION,
  "minAmount" DOUBLE PRECISION,
  "maxAmount" DOUBLE PRECISION,
  "tiers" JSONB,
  "appliesFrom" TIMESTAMP(3),
  "appliesTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disputes_disputeCode_key" ON "disputes"("disputeCode");

-- CreateIndex
CREATE INDEX "disputes_bookingId_idx" ON "disputes"("bookingId");

-- CreateIndex
CREATE INDEX "disputes_raisedBy_idx" ON "disputes"("raisedBy");

-- CreateIndex
CREATE INDEX "disputes_raisedAgainst_idx" ON "disputes"("raisedAgainst");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "disputes_priority_idx" ON "disputes"("priority");

-- CreateIndex
CREATE INDEX "disputes_assignedTo_idx" ON "disputes"("assignedTo");

-- CreateIndex
CREATE INDEX "disputes_createdAt_idx" ON "disputes"("createdAt");

-- CreateIndex
CREATE INDEX "dispute_messages_disputeId_idx" ON "dispute_messages"("disputeId");

-- CreateIndex
CREATE INDEX "dispute_messages_senderId_idx" ON "dispute_messages"("senderId");

-- CreateIndex
CREATE INDEX "dispute_messages_createdAt_idx" ON "dispute_messages"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_settlementCode_key" ON "settlements"("settlementCode");

-- CreateIndex
CREATE INDEX "settlements_ownerId_idx" ON "settlements"("ownerId");

-- CreateIndex
CREATE INDEX "settlements_status_idx" ON "settlements"("status");

-- CreateIndex
CREATE INDEX "settlements_period_idx" ON "settlements"("period");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_bookings_settlementId_bookingId_key" ON "settlement_bookings"("settlementId", "bookingId");

-- CreateIndex
CREATE INDEX "settlement_bookings_settlementId_idx" ON "settlement_bookings"("settlementId");

-- CreateIndex
CREATE INDEX "settlement_bookings_bookingId_idx" ON "settlement_bookings"("bookingId");

-- CreateIndex
CREATE INDEX "commission_rules_isActive_idx" ON "commission_rules"("isActive");

-- CreateIndex
CREATE INDEX "commission_rules_appliesFrom_appliesTo_idx" ON "commission_rules"("appliesFrom", "appliesTo");

-- AddForeignKey
ALTER TABLE "disputes"
  ADD CONSTRAINT "disputes_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes"
  ADD CONSTRAINT "disputes_raisedBy_fkey"
  FOREIGN KEY ("raisedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes"
  ADD CONSTRAINT "disputes_raisedAgainst_fkey"
  FOREIGN KEY ("raisedAgainst") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes"
  ADD CONSTRAINT "disputes_assignedTo_fkey"
  FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_messages"
  ADD CONSTRAINT "dispute_messages_disputeId_fkey"
  FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_messages"
  ADD CONSTRAINT "dispute_messages_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements"
  ADD CONSTRAINT "settlements_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements"
  ADD CONSTRAINT "settlements_processedBy_fkey"
  FOREIGN KEY ("processedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_bookings"
  ADD CONSTRAINT "settlement_bookings_settlementId_fkey"
  FOREIGN KEY ("settlementId") REFERENCES "settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_bookings"
  ADD CONSTRAINT "settlement_bookings_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules"
  ADD CONSTRAINT "commission_rules_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules"
  ADD CONSTRAINT "commission_rules_updatedBy_fkey"
  FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
