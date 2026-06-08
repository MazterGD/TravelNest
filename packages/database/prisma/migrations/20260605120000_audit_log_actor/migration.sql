-- AuditLog: make adminId optional and introduce an actor (any-role) attribution.

-- 1. New columns
ALTER TABLE "audit_logs" ADD COLUMN "actorId" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "actorRole" TEXT;

-- 2. adminId becomes optional (non-admin actions have no admin attribution)
ALTER TABLE "audit_logs" ALTER COLUMN "adminId" DROP NOT NULL;

-- 3. Backfill: every existing row was an admin action
UPDATE "audit_logs"
SET "actorId" = "adminId", "actorRole" = 'ADMIN'
WHERE "actorId" IS NULL;

-- 4. Replace the admin FK (was ON DELETE CASCADE) with SET NULL so audit history
--    survives user deletion.
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_adminId_fkey";
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Actor FK
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Indexes
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX "audit_logs_actorRole_idx" ON "audit_logs"("actorRole");
