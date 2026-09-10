-- CreateEnum
CREATE TYPE "ClassArmSource" AS ENUM ('ENTERED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "StudentClassHistoryStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'REPEATED', 'TRANSFERRED_OUT', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "ReportCard" ADD COLUMN     "classArmId" TEXT,
ADD COLUMN     "classArmSource" "ClassArmSource";

-- AlterTable
ALTER TABLE "Score" ADD COLUMN     "classArmId" TEXT,
ADD COLUMN     "classArmSource" "ClassArmSource";

-- CreateTable
CREATE TABLE "StudentClassHistory" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "classArmId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "StudentClassHistoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "ClassArmSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentClassHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentClassHistory_schoolId_idx" ON "StudentClassHistory"("schoolId");

-- CreateIndex
CREATE INDEX "StudentClassHistory_schoolId_studentId_academicSessionId_idx" ON "StudentClassHistory"("schoolId", "studentId", "academicSessionId");

-- CreateIndex
CREATE INDEX "StudentClassHistory_schoolId_academicSessionId_classArmId_idx" ON "StudentClassHistory"("schoolId", "academicSessionId", "classArmId");

-- CreateIndex
CREATE INDEX "Score_schoolId_classArmId_termId_idx" ON "Score"("schoolId", "classArmId", "termId");

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_classArmId_fkey" FOREIGN KEY ("classArmId") REFERENCES "ClassArm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_classArmId_fkey" FOREIGN KEY ("classArmId") REFERENCES "ClassArm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentClassHistory" ADD CONSTRAINT "StudentClassHistory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentClassHistory" ADD CONSTRAINT "StudentClassHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentClassHistory" ADD CONSTRAINT "StudentClassHistory_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentClassHistory" ADD CONSTRAINT "StudentClassHistory_classArmId_fkey" FOREIGN KEY ("classArmId") REFERENCES "ClassArm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
