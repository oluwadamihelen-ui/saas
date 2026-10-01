-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "renewal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RiskSettings" ADD COLUMN     "drawdownType" TEXT NOT NULL DEFAULT 'STATIC',
ADD COLUMN     "maxTotalDrawdownPercent" DOUBLE PRECISION,
ADD COLUMN     "profitTargetPercent" DOUBLE PRECISION,
ADD COLUMN     "ruleTemplate" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "authorizationCode" TEXT,
ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "lastRenewalAttemptAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyLimits" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "telegramChatId" TEXT,
ADD COLUMN     "telegramLinkCode" TEXT,
ADD COLUMN     "telegramLinkExpires" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_eventKey_key" ON "WebhookEvent"("provider", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_userId_kind_key_key" ON "NotificationLog"("userId", "kind", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_accountId_externalId_key" ON "Trade"("accountId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramChatId_key" ON "User"("telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramLinkCode_key" ON "User"("telegramLinkCode");

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

