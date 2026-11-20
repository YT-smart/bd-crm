-- 旧的 Notification 表从未使用过（没有数据），先清空再加必填列
DELETE FROM "Notification";

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('ORG', 'LEAD', 'DEAL');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "actorName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "category" "NotificationCategory" NOT NULL,
ADD COLUMN     "count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "groupKey" TEXT,
ADD COLUMN     "items" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "targetId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Notification_userId_updatedAt_idx" ON "Notification"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_groupKey_idx" ON "Notification"("userId", "groupKey");

