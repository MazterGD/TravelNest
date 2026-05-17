-- CreateEnum
CREATE TYPE "AdminReportType" AS ENUM (
  'USERS',
  'BOOKINGS',
  'FINANCIAL',
  'OPERATIONS',
  'AUDIT',
  'DISPUTES',
  'VERIFICATIONS',
  'SYSTEM'
);

-- CreateEnum
CREATE TYPE "AdminReportFormat" AS ENUM ('CSV', 'PDF', 'EXCEL');

-- CreateEnum
CREATE TYPE "AdminReportFrequency" AS ENUM ('ON_DEMAND', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ScheduledReportRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "scheduled_reports" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "reportType" "AdminReportType" NOT NULL,
  "format" "AdminReportFormat" NOT NULL DEFAULT 'CSV',
  "frequency" "AdminReportFrequency" NOT NULL DEFAULT 'ON_DEMAND',
  "cronExpression" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Colombo',
  "configuration" JSONB,
  "recipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt" TIMESTAMP(3),
  "nextRunAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_report_runs" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "triggeredBy" TEXT,
  "triggerSource" TEXT NOT NULL DEFAULT 'MANUAL',
  "status" "ScheduledReportRunStatus" NOT NULL DEFAULT 'QUEUED',
  "format" "AdminReportFormat" NOT NULL DEFAULT 'CSV',
  "fileName" TEXT,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "scheduled_report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_reports_reportType_idx" ON "scheduled_reports"("reportType");

-- CreateIndex
CREATE INDEX "scheduled_reports_frequency_isActive_idx" ON "scheduled_reports"("frequency", "isActive");

-- CreateIndex
CREATE INDEX "scheduled_reports_nextRunAt_idx" ON "scheduled_reports"("nextRunAt");

-- CreateIndex
CREATE INDEX "scheduled_reports_createdBy_idx" ON "scheduled_reports"("createdBy");

-- CreateIndex
CREATE INDEX "scheduled_reports_updatedAt_idx" ON "scheduled_reports"("updatedAt");

-- CreateIndex
CREATE INDEX "scheduled_report_runs_reportId_startedAt_idx" ON "scheduled_report_runs"("reportId", "startedAt");

-- CreateIndex
CREATE INDEX "scheduled_report_runs_status_idx" ON "scheduled_report_runs"("status");

-- CreateIndex
CREATE INDEX "scheduled_report_runs_triggeredBy_idx" ON "scheduled_report_runs"("triggeredBy");

-- CreateIndex
CREATE INDEX "scheduled_report_runs_startedAt_idx" ON "scheduled_report_runs"("startedAt");

-- AddForeignKey
ALTER TABLE "scheduled_reports"
  ADD CONSTRAINT "scheduled_reports_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports"
  ADD CONSTRAINT "scheduled_reports_updatedBy_fkey"
  FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_report_runs"
  ADD CONSTRAINT "scheduled_report_runs_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "scheduled_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_report_runs"
  ADD CONSTRAINT "scheduled_report_runs_triggeredBy_fkey"
  FOREIGN KEY ("triggeredBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
