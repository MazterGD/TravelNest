-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'System';

-- CreateIndex
CREATE INDEX "notifications_category_idx" ON "notifications"("category");
