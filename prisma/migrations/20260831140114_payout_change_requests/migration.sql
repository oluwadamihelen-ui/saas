-- CreateEnum
CREATE TYPE "PayoutChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "SecurityAnswer" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answerHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutAccountChangeRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT,
    "resolvedAccountName" TEXT,
    "reason" TEXT,
    "status" "PayoutChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutAccountChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SecurityAnswer_businessId_question_key" ON "SecurityAnswer"("businessId", "question");

-- CreateIndex
CREATE INDEX "PayoutAccountChangeRequest_businessId_idx" ON "PayoutAccountChangeRequest"("businessId");

-- CreateIndex
CREATE INDEX "PayoutAccountChangeRequest_status_idx" ON "PayoutAccountChangeRequest"("status");

-- AddForeignKey
ALTER TABLE "SecurityAnswer" ADD CONSTRAINT "SecurityAnswer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAccountChangeRequest" ADD CONSTRAINT "PayoutAccountChangeRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAccountChangeRequest" ADD CONSTRAINT "PayoutAccountChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAccountChangeRequest" ADD CONSTRAINT "PayoutAccountChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
