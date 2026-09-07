-- CreateEnum
CREATE TYPE "ApplicationVersionStatus" AS ENUM ('DRAFT', 'TESTING', 'STABLE', 'DEPRECATED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('DOCKER_IMAGE', 'GIT_REPOSITORY', 'GIT_COMMIT', 'ARCHIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "RenewalReferenceType" AS ENUM ('DOMAIN', 'HOSTING', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "RenewalStatus" AS ENUM ('UPCOMING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeploymentTargetType" AS ENUM ('CUSTOMER_SERVER', 'PLATFORM_HOSTING', 'MANAGED', 'MOCK');

-- CreateEnum
CREATE TYPE "DeploymentTargetStatus" AS ENUM ('PENDING', 'VALIDATED', 'ACTIVE', 'ERROR', 'ARCHIVED');

-- AlterEnum
BEGIN;
CREATE TYPE "DeploymentStatus_new" AS ENUM ('DRAFT', 'QUEUED', 'PREPARING', 'CONNECTING', 'INSTALLING', 'CONFIGURING', 'DATABASE_SETUP', 'MIGRATING', 'DNS_SETUP', 'SSL_SETUP', 'HEALTH_CHECK', 'COMPLETED', 'FAILED', 'ROLLING_BACK', 'ROLLED_BACK', 'NEEDS_CUSTOMER_ACTION', 'CANCELLED');
ALTER TABLE "public"."Deployment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Deployment" ALTER COLUMN "status" TYPE "DeploymentStatus_new" USING ("status"::text::"DeploymentStatus_new");
ALTER TYPE "DeploymentStatus" RENAME TO "DeploymentStatus_old";
ALTER TYPE "DeploymentStatus_new" RENAME TO "DeploymentStatus";
DROP TYPE "public"."DeploymentStatus_old";
ALTER TABLE "Deployment" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- AlterEnum
ALTER TYPE "PricingType" ADD VALUE 'OTHER';

-- DropForeignKey
ALTER TABLE "DeploymentCredential" DROP CONSTRAINT "DeploymentCredential_deploymentId_fkey";

-- DropIndex
DROP INDEX "DeploymentCredential_deploymentId_idx";

-- AlterTable
ALTER TABLE "ApplicationVersion" DROP COLUMN "buildCommand",
DROP COLUMN "databaseType",
DROP COLUMN "envVarsSchema",
DROP COLUMN "healthCheckPath",
DROP COLUMN "isCurrent",
DROP COLUMN "migrationCommand",
DROP COLUMN "releaseNotes",
DROP COLUMN "requiredServices",
DROP COLUMN "runtime",
DROP COLUMN "seedCommand",
DROP COLUMN "startCommand",
ADD COLUMN     "deploymentSpecificationId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isLatest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isStable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "packageReference" TEXT,
ADD COLUMN     "releaseName" TEXT,
ADD COLUMN     "status" "ApplicationVersionStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Deployment" DROP COLUMN "adapter",
DROP COLUMN "serverConfig",
ADD COLUMN     "deploymentTargetId" TEXT,
ADD COLUMN     "previewUrl" TEXT,
ADD COLUMN     "previousDeploymentId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "DeploymentCredential" DROP COLUMN "deploymentId",
ADD COLUMN     "deploymentTargetId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "currentPeriodStart" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DeploymentSpecification" (
    "id" TEXT NOT NULL,
    "runtime" TEXT NOT NULL,
    "runtimeVersion" TEXT,
    "framework" TEXT,
    "frameworkVersion" TEXT,
    "packageManager" TEXT,
    "installCommand" TEXT,
    "buildCommand" TEXT,
    "startCommand" TEXT,
    "port" INTEGER DEFAULT 3000,
    "healthCheckPath" TEXT DEFAULT '/api/health',
    "databaseType" TEXT,
    "databaseVersion" TEXT,
    "requiredServices" TEXT[],
    "environmentVariables" JSONB NOT NULL,
    "migrationCommand" TEXT,
    "seedCommand" TEXT,
    "deploymentMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentSpecification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationArtifact" (
    "id" TEXT NOT NULL,
    "applicationVersionId" TEXT NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "reference" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" DECIMAL(12,2),
    "currency" TEXT,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenewalEvent" (
    "id" TEXT NOT NULL,
    "referenceType" "RenewalReferenceType" NOT NULL,
    "subscriptionId" TEXT,
    "domainId" TEXT,
    "hostingAccountId" TEXT,
    "status" "RenewalStatus" NOT NULL DEFAULT 'UPCOMING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "processedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenewalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentTarget" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "organizationId" TEXT,
    "label" TEXT,
    "type" "DeploymentTargetType" NOT NULL,
    "provider" TEXT NOT NULL,
    "hostname" TEXT,
    "port" INTEGER,
    "operatingSystem" TEXT,
    "controlPanel" TEXT,
    "region" TEXT,
    "hostingAccountId" TEXT,
    "domainId" TEXT,
    "status" "DeploymentTargetStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationArtifact_applicationVersionId_key" ON "ApplicationArtifact"("applicationVersionId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_orderId_idx" ON "PaymentWebhookEvent"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventId_key" ON "PaymentWebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "RenewalEvent_referenceType_idx" ON "RenewalEvent"("referenceType");

-- CreateIndex
CREATE INDEX "RenewalEvent_status_idx" ON "RenewalEvent"("status");

-- CreateIndex
CREATE INDEX "RenewalEvent_dueDate_idx" ON "RenewalEvent"("dueDate");

-- CreateIndex
CREATE INDEX "DeploymentTarget_customerId_idx" ON "DeploymentTarget"("customerId");

-- CreateIndex
CREATE INDEX "DeploymentTarget_type_idx" ON "DeploymentTarget"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationVersion_deploymentSpecificationId_key" ON "ApplicationVersion"("deploymentSpecificationId");

-- CreateIndex
CREATE INDEX "ApplicationVersion_status_idx" ON "ApplicationVersion"("status");

-- CreateIndex
CREATE INDEX "Deployment_deploymentTargetId_idx" ON "Deployment"("deploymentTargetId");

-- CreateIndex
CREATE INDEX "DeploymentCredential_deploymentTargetId_idx" ON "DeploymentCredential"("deploymentTargetId");

-- AddForeignKey
ALTER TABLE "ApplicationVersion" ADD CONSTRAINT "ApplicationVersion_deploymentSpecificationId_fkey" FOREIGN KEY ("deploymentSpecificationId") REFERENCES "DeploymentSpecification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationArtifact" ADD CONSTRAINT "ApplicationArtifact_applicationVersionId_fkey" FOREIGN KEY ("applicationVersionId") REFERENCES "ApplicationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalEvent" ADD CONSTRAINT "RenewalEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalEvent" ADD CONSTRAINT "RenewalEvent_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalEvent" ADD CONSTRAINT "RenewalEvent_hostingAccountId_fkey" FOREIGN KEY ("hostingAccountId") REFERENCES "HostingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentTarget" ADD CONSTRAINT "DeploymentTarget_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentTarget" ADD CONSTRAINT "DeploymentTarget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentTarget" ADD CONSTRAINT "DeploymentTarget_hostingAccountId_fkey" FOREIGN KEY ("hostingAccountId") REFERENCES "HostingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentTarget" ADD CONSTRAINT "DeploymentTarget_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_deploymentTargetId_fkey" FOREIGN KEY ("deploymentTargetId") REFERENCES "DeploymentTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_previousDeploymentId_fkey" FOREIGN KEY ("previousDeploymentId") REFERENCES "Deployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentCredential" ADD CONSTRAINT "DeploymentCredential_deploymentTargetId_fkey" FOREIGN KEY ("deploymentTargetId") REFERENCES "DeploymentTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

