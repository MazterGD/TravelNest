-- CreateEnum
CREATE TYPE "PlatformNotificationStatus" AS ENUM (
  'DRAFT',
  'SCHEDULED',
  'SENT',
  'FAILED',
  'CANCELLED'
);

-- CreateEnum
CREATE TYPE "PlatformNotificationChannel" AS ENUM (
  'IN_APP',
  'EMAIL',
  'SMS'
);

-- CreateTable
CREATE TABLE "platform_settings" (
  "id" TEXT NOT NULL,
  "generalSettings" JSONB,
  "notificationSettings" JSONB,
  "paymentSettings" JSONB,
  "bookingSettings" JSONB,
  "securitySettings" JSONB,
  "mapSettings" JSONB,
  "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
  "maintenanceMessage" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_pages" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "excerpt" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "content_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
  "id" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "category" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amenities" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_notifications" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'ANNOUNCEMENT',
  "channel" "PlatformNotificationChannel" NOT NULL DEFAULT 'IN_APP',
  "status" "PlatformNotificationStatus" NOT NULL DEFAULT 'DRAFT',
  "targetRole" "UserRole",
  "targetUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "scheduledFor" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "resentFromId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "platform_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_settings_updatedBy_idx" ON "platform_settings"("updatedBy");

-- CreateIndex
CREATE UNIQUE INDEX "content_pages_slug_key" ON "content_pages"("slug");

-- CreateIndex
CREATE INDEX "content_pages_isPublished_idx" ON "content_pages"("isPublished");

-- CreateIndex
CREATE INDEX "content_pages_updatedAt_idx" ON "content_pages"("updatedAt");

-- CreateIndex
CREATE INDEX "faqs_category_idx" ON "faqs"("category");

-- CreateIndex
CREATE INDEX "faqs_sortOrder_idx" ON "faqs"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "amenities_code_key" ON "amenities"("code");

-- CreateIndex
CREATE INDEX "amenities_isActive_idx" ON "amenities"("isActive");

-- CreateIndex
CREATE INDEX "amenities_sortOrder_idx" ON "amenities"("sortOrder");

-- CreateIndex
CREATE INDEX "platform_notifications_status_idx" ON "platform_notifications"("status");

-- CreateIndex
CREATE INDEX "platform_notifications_targetRole_idx" ON "platform_notifications"("targetRole");

-- CreateIndex
CREATE INDEX "platform_notifications_createdBy_idx" ON "platform_notifications"("createdBy");

-- CreateIndex
CREATE INDEX "platform_notifications_sentAt_idx" ON "platform_notifications"("sentAt");

-- AddForeignKey
ALTER TABLE "platform_settings"
  ADD CONSTRAINT "platform_settings_updatedBy_fkey"
  FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_pages"
  ADD CONSTRAINT "content_pages_updatedBy_fkey"
  FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs"
  ADD CONSTRAINT "faqs_updatedBy_fkey"
  FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amenities"
  ADD CONSTRAINT "amenities_updatedBy_fkey"
  FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_notifications"
  ADD CONSTRAINT "platform_notifications_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_notifications"
  ADD CONSTRAINT "platform_notifications_resentFromId_fkey"
  FOREIGN KEY ("resentFromId") REFERENCES "platform_notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
