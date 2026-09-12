-- CreateEnum
CREATE TYPE "ClassAssessmentMode" AS ENUM ('NUMERICAL', 'MILESTONE', 'BOTH');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PreschoolAssessmentPeriodType" AS ENUM ('CONTINUOUS_ASSESSMENT', 'TEST', 'EXAMINATION', 'MID_TERM', 'END_OF_TERM', 'OBSERVATION', 'WEEKLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PreschoolAssessmentLevel" AS ENUM ('EXCEEDED', 'ACHIEVED', 'PROGRESSING', 'DEVELOPING', 'NEEDS_SUPPORT');

-- CreateEnum
CREATE TYPE "PreschoolResultStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED');

-- AlterTable
ALTER TABLE "ClassGroup" ADD COLUMN     "assessmentMode" "ClassAssessmentMode" NOT NULL DEFAULT 'NUMERICAL';

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "preschoolParentsCanView" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "preschoolRequireApprovalToPublish" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "preschoolRequireTeacherComment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preschoolResultsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "preschoolStudentsCanView" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SchemeOfWork" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchemeOfWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeOfWorkTopic" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schemeOfWorkId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchemeOfWorkTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreschoolMilestone" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreschoolMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreschoolAssessmentPeriod" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PreschoolAssessmentPeriodType" NOT NULL DEFAULT 'CUSTOM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreschoolAssessmentPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreschoolAssessmentLevelLabel" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "level" "PreschoolAssessmentLevel" NOT NULL,
    "label" TEXT NOT NULL,
    "colorVariant" TEXT NOT NULL DEFAULT 'neutral',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreschoolAssessmentLevelLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreschoolMilestoneAssessment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "assessmentPeriodId" TEXT NOT NULL,
    "level" "PreschoolAssessmentLevel" NOT NULL,
    "comment" TEXT,
    "assessedById" TEXT NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreschoolMilestoneAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreschoolReport" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "status" "PreschoolResultStatus" NOT NULL DEFAULT 'DRAFT',
    "overallComment" TEXT,
    "teacherComment" TEXT,
    "principalComment" TEXT,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreschoolReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchemeOfWork_schoolId_idx" ON "SchemeOfWork"("schoolId");

-- CreateIndex
CREATE INDEX "SchemeOfWork_schoolId_classGroupId_subjectId_idx" ON "SchemeOfWork"("schoolId", "classGroupId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SchemeOfWork_schoolId_termId_classGroupId_subjectId_key" ON "SchemeOfWork"("schoolId", "termId", "classGroupId", "subjectId");

-- CreateIndex
CREATE INDEX "SchemeOfWorkTopic_schoolId_idx" ON "SchemeOfWorkTopic"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchemeOfWorkTopic_schemeOfWorkId_weekNumber_key" ON "SchemeOfWorkTopic"("schemeOfWorkId", "weekNumber");

-- CreateIndex
CREATE INDEX "PreschoolMilestone_schoolId_idx" ON "PreschoolMilestone"("schoolId");

-- CreateIndex
CREATE INDEX "PreschoolMilestone_topicId_idx" ON "PreschoolMilestone"("topicId");

-- CreateIndex
CREATE INDEX "PreschoolAssessmentPeriod_schoolId_idx" ON "PreschoolAssessmentPeriod"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "PreschoolAssessmentPeriod_schoolId_termId_name_key" ON "PreschoolAssessmentPeriod"("schoolId", "termId", "name");

-- CreateIndex
CREATE INDEX "PreschoolAssessmentLevelLabel_schoolId_idx" ON "PreschoolAssessmentLevelLabel"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "PreschoolAssessmentLevelLabel_schoolId_level_key" ON "PreschoolAssessmentLevelLabel"("schoolId", "level");

-- CreateIndex
CREATE INDEX "PreschoolMilestoneAssessment_schoolId_idx" ON "PreschoolMilestoneAssessment"("schoolId");

-- CreateIndex
CREATE INDEX "PreschoolMilestoneAssessment_schoolId_studentId_termId_idx" ON "PreschoolMilestoneAssessment"("schoolId", "studentId", "termId");

-- CreateIndex
CREATE INDEX "PreschoolMilestoneAssessment_schoolId_milestoneId_idx" ON "PreschoolMilestoneAssessment"("schoolId", "milestoneId");

-- CreateIndex
CREATE INDEX "PreschoolMilestoneAssessment_schoolId_assessmentPeriodId_idx" ON "PreschoolMilestoneAssessment"("schoolId", "assessmentPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "PreschoolMilestoneAssessment_studentId_milestoneId_assessme_key" ON "PreschoolMilestoneAssessment"("studentId", "milestoneId", "assessmentPeriodId");

-- CreateIndex
CREATE INDEX "PreschoolReport_schoolId_idx" ON "PreschoolReport"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "PreschoolReport_studentId_termId_key" ON "PreschoolReport"("studentId", "termId");

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWork" ADD CONSTRAINT "SchemeOfWork_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWorkTopic" ADD CONSTRAINT "SchemeOfWorkTopic_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeOfWorkTopic" ADD CONSTRAINT "SchemeOfWorkTopic_schemeOfWorkId_fkey" FOREIGN KEY ("schemeOfWorkId") REFERENCES "SchemeOfWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolMilestone" ADD CONSTRAINT "PreschoolMilestone_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolMilestone" ADD CONSTRAINT "PreschoolMilestone_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SchemeOfWorkTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolMilestone" ADD CONSTRAINT "PreschoolMilestone_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolAssessmentPeriod" ADD CONSTRAINT "PreschoolAssessmentPeriod_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolAssessmentPeriod" ADD CONSTRAINT "PreschoolAssessmentPeriod_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolAssessmentLevelLabel" ADD CONSTRAINT "PreschoolAssessmentLevelLabel_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolMilestoneAssessment" ADD CONSTRAINT "PreschoolMilestoneAssessment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolMilestoneAssessment" ADD CONSTRAINT "PreschoolMilestoneAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolMilestoneAssessment" ADD CONSTRAINT "PreschoolMilestoneAssessment_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "PreschoolMilestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolMilestoneAssessment" ADD CONSTRAINT "PreschoolMilestoneAssessment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolMilestoneAssessment" ADD CONSTRAINT "PreschoolMilestoneAssessment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolMilestoneAssessment" ADD CONSTRAINT "PreschoolMilestoneAssessment_assessmentPeriodId_fkey" FOREIGN KEY ("assessmentPeriodId") REFERENCES "PreschoolAssessmentPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolMilestoneAssessment" ADD CONSTRAINT "PreschoolMilestoneAssessment_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolReport" ADD CONSTRAINT "PreschoolReport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolReport" ADD CONSTRAINT "PreschoolReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolReport" ADD CONSTRAINT "PreschoolReport_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolReport" ADD CONSTRAINT "PreschoolReport_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreschoolReport" ADD CONSTRAINT "PreschoolReport_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
