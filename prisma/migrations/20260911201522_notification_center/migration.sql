-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('ACADEMIC', 'ATTENDANCE', 'ASSIGNMENT', 'EXAM', 'RESULT', 'FEES', 'PAYMENT', 'ADMISSION', 'TIMETABLE', 'ONLINE_CLASS', 'ANNOUNCEMENT', 'EVENT', 'MESSAGING', 'BIRTHDAY', 'STAFF', 'HR', 'PAYROLL', 'LIBRARY', 'TRANSPORT', 'HOSTEL', 'INVENTORY', 'SYSTEM', 'AI_INSIGHT');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_GRADED';
ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_GRADING_PENDING';
ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_DUE_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'TEACHER_SCORES_PENDING';
ALTER TYPE "NotificationType" ADD VALUE 'ADMIN_ACTION_ITEM';
ALTER TYPE "NotificationType" ADD VALUE 'BIRTHDAY_UPCOMING';
ALTER TYPE "NotificationType" ADD VALUE 'FEES_OUTSTANDING';
ALTER TYPE "NotificationType" ADD VALUE 'ATTENDANCE_CONCERN';
ALTER TYPE "NotificationType" ADD VALUE 'AI_DAILY_SUMMARY';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "actionLabel" TEXT,
ADD COLUMN     "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "notificationRulesLastRunAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationPreference_schoolId_idx" ON "NotificationPreference"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_category_key" ON "NotificationPreference"("userId", "category");

-- CreateIndex
CREATE INDEX "Notification_userId_category_idx" ON "Notification"("userId", "category");

-- CreateIndex
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

