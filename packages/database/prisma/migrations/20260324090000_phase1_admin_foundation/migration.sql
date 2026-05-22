-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'MODERATOR', 'FINANCE_ADMIN', 'SUPPORT_ADMIN');

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "adminRole" "AdminRole";

-- CreateTable
CREATE TABLE "admin_permissions" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "grantedBy" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),

  CONSTRAINT "admin_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "changes" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "status" TEXT NOT NULL DEFAULT 'success',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_permissions_adminId_permission_key" ON "admin_permissions"("adminId", "permission");

-- CreateIndex
CREATE INDEX "admin_permissions_adminId_idx" ON "admin_permissions"("adminId");

-- CreateIndex
CREATE INDEX "audit_logs_adminId_idx" ON "audit_logs"("adminId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "owner_documents_status_idx" ON "owner_documents"("status");

-- CreateIndex
CREATE INDEX "vehicle_documents_status_idx" ON "vehicle_documents"("status");

-- AddForeignKey
ALTER TABLE "admin_permissions"
  ADD CONSTRAINT "admin_permissions_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
