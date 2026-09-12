-- CreateEnum
CREATE TYPE "ImportDataType" AS ENUM ('STUDENTS', 'RESULTS', 'CBT_QUESTIONS');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "dataType" "ImportDataType" NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "academicSessionId" TEXT,
    "termId" TEXT,
    "classArmId" TEXT,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "failedCount" INTEGER NOT NULL,
    "rowErrors" JSONB,
    "importedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_schoolId_createdAt_idx" ON "ImportBatch"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_schoolId_dataType_idx" ON "ImportBatch"("schoolId", "dataType");

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_classArmId_fkey" FOREIGN KEY ("classArmId") REFERENCES "ClassArm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
