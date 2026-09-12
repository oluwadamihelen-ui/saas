-- CreateEnum
CREATE TYPE "CBTQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE', 'SHORT_ANSWER', 'FILL_IN_BLANK', 'ESSAY', 'MATCHING', 'ORDERING');

-- CreateEnum
CREATE TYPE "CBTDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "CBTQuestionStatus" AS ENUM ('DRAFT', 'AI_PENDING_REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CBTQuestionSource" AS ENUM ('MANUAL', 'AI_GENERATED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "CBTExamStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'LIVE', 'ENDED', 'GRADING', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CBTQuestionSelectionMode" AS ENUM ('MANUAL', 'BLUEPRINT');

-- CreateEnum
CREATE TYPE "CBTResultVisibility" AS ENUM ('IMMEDIATE', 'AFTER_GRADING', 'MANUAL_RELEASE');

-- CreateEnum
CREATE TYPE "CBTCandidateAttendanceStatus" AS ENUM ('PENDING', 'ATTEMPTED', 'ABSENT', 'EXCUSED', 'MAKEUP_SCHEDULED');

-- CreateEnum
CREATE TYPE "CBTAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'GRADED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "CBTAnswerGradingStatus" AS ENUM ('PENDING', 'AUTO_GRADED', 'MANUALLY_GRADED', 'NEEDS_MANUAL_GRADING');

-- CreateEnum
CREATE TYPE "CBTSecurityEventType" AS ENUM ('TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT', 'COPY_ATTEMPT', 'PASTE_ATTEMPT', 'RIGHT_CLICK_ATTEMPT', 'CONNECTION_LOST', 'CONNECTION_RESTORED', 'SUSPICIOUS_NAVIGATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CBT_EXAM_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'CBT_EXAM_STARTING_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'CBT_EXAM_AVAILABLE';
ALTER TYPE "NotificationType" ADD VALUE 'CBT_EXAM_ENDING_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'CBT_RESULT_AVAILABLE';
ALTER TYPE "NotificationType" ADD VALUE 'CBT_EXAM_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'CBT_MANUAL_GRADING_REQUIRED';
ALTER TYPE "NotificationType" ADD VALUE 'CBT_RESULT_PUBLISHED';

-- CreateTable
CREATE TABLE "CBTExamTypeOption" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CBTExamTypeOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CBTQuestion" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classGroupId" TEXT,
    "type" "CBTQuestionType" NOT NULL,
    "status" "CBTQuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "difficulty" "CBTDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "source" "CBTQuestionSource" NOT NULL DEFAULT 'MANUAL',
    "topic" TEXT,
    "subtopic" TEXT,
    "learningObjective" TEXT,
    "prompt" TEXT NOT NULL,
    "imageUrl" TEXT,
    "audioUrl" TEXT,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "explanation" TEXT,
    "acceptedAnswers" JSONB,
    "rubric" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CBTQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CBTQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "matchText" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CBTQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CBTQuestionTag" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CBTQuestionTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CBTQuestionTagAssignment" (
    "questionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "CBTQuestionTagAssignment_pkey" PRIMARY KEY ("questionId","tagId")
);

-- CreateTable
CREATE TABLE "CBTExam" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "examTypeId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "assessmentComponentId" TEXT,
    "instructions" TEXT,
    "status" "CBTExamStatus" NOT NULL DEFAULT 'DRAFT',
    "isPractice" BOOLEAN NOT NULL DEFAULT false,
    "questionSelectionMode" "CBTQuestionSelectionMode" NOT NULL DEFAULT 'MANUAL',
    "totalMarks" INTEGER NOT NULL DEFAULT 0,
    "randomizeQuestionOrder" BOOLEAN NOT NULL DEFAULT false,
    "randomizeOptionOrder" BOOLEAN NOT NULL DEFAULT false,
    "negativeMarkingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "negativeMarkPerWrong" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "requireFullscreen" BOOLEAN NOT NULL DEFAULT false,
    "detectTabSwitch" BOOLEAN NOT NULL DEFAULT true,
    "restrictCopyPaste" BOOLEAN NOT NULL DEFAULT false,
    "restrictRightClick" BOOLEAN NOT NULL DEFAULT false,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "autoSubmitOnExpiry" BOOLEAN NOT NULL DEFAULT true,
    "desktopOnly" BOOLEAN NOT NULL DEFAULT false,
    "resultVisibility" "CBTResultVisibility" NOT NULL DEFAULT 'AFTER_GRADING',
    "showCorrectAnswers" BOOLEAN NOT NULL DEFAULT false,
    "showExplanations" BOOLEAN NOT NULL DEFAULT false,
    "showRanking" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CBTExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CBTExamQuestion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "marksOverride" INTEGER,

    CONSTRAINT "CBTExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CBTExamBlueprint" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "totalQuestions" INTEGER NOT NULL,

    CONSTRAINT "CBTExamBlueprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CBTExamBlueprintRule" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "topic" TEXT,
    "difficulty" "CBTDifficulty",
    "count" INTEGER NOT NULL,

    CONSTRAINT "CBTExamBlueprintRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CBTExamCandidate" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "maxAttemptsOverride" INTEGER,
    "extraTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "extensionReason" TEXT,
    "extensionGrantedById" TEXT,
    "attendanceStatus" "CBTCandidateAttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CBTExamCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CBTAttempt" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "CBTAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "isPractice" BOOLEAN NOT NULL DEFAULT false,
    "isOfficialResult" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "percentage" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CBTAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CBTAttemptQuestion" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "marks" INTEGER NOT NULL,
    "optionOrder" JSONB,

    CONSTRAINT "CBTAttemptQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CBTAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" JSONB,
    "isCorrect" BOOLEAN,
    "marksAwarded" DOUBLE PRECISION,
    "gradingStatus" "CBTAnswerGradingStatus" NOT NULL DEFAULT 'PENDING',
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CBTAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CBTManualGrade" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "marksAwarded" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT,
    "aiSuggestedMarks" DOUBLE PRECISION,
    "aiSuggestedFeedback" TEXT,
    "gradedById" TEXT NOT NULL,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CBTManualGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CBTSecurityEvent" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "type" "CBTSecurityEventType" NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CBTSecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CBTExamTypeOption_schoolId_idx" ON "CBTExamTypeOption"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "CBTExamTypeOption_schoolId_key_key" ON "CBTExamTypeOption"("schoolId", "key");

-- CreateIndex
CREATE INDEX "CBTQuestion_schoolId_idx" ON "CBTQuestion"("schoolId");

-- CreateIndex
CREATE INDEX "CBTQuestion_schoolId_subjectId_idx" ON "CBTQuestion"("schoolId", "subjectId");

-- CreateIndex
CREATE INDEX "CBTQuestion_schoolId_status_idx" ON "CBTQuestion"("schoolId", "status");

-- CreateIndex
CREATE INDEX "CBTQuestion_schoolId_subjectId_topic_difficulty_idx" ON "CBTQuestion"("schoolId", "subjectId", "topic", "difficulty");

-- CreateIndex
CREATE INDEX "CBTQuestionOption_questionId_idx" ON "CBTQuestionOption"("questionId");

-- CreateIndex
CREATE INDEX "CBTQuestionTag_schoolId_idx" ON "CBTQuestionTag"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "CBTQuestionTag_schoolId_name_key" ON "CBTQuestionTag"("schoolId", "name");

-- CreateIndex
CREATE INDEX "CBTExam_schoolId_idx" ON "CBTExam"("schoolId");

-- CreateIndex
CREATE INDEX "CBTExam_schoolId_status_idx" ON "CBTExam"("schoolId", "status");

-- CreateIndex
CREATE INDEX "CBTExam_schoolId_subjectId_idx" ON "CBTExam"("schoolId", "subjectId");

-- CreateIndex
CREATE INDEX "CBTExam_schoolId_termId_idx" ON "CBTExam"("schoolId", "termId");

-- CreateIndex
CREATE INDEX "CBTExamQuestion_examId_idx" ON "CBTExamQuestion"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "CBTExamQuestion_examId_questionId_key" ON "CBTExamQuestion"("examId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "CBTExamBlueprint_examId_key" ON "CBTExamBlueprint"("examId");

-- CreateIndex
CREATE INDEX "CBTExamBlueprintRule_blueprintId_idx" ON "CBTExamBlueprintRule"("blueprintId");

-- CreateIndex
CREATE INDEX "CBTExamCandidate_schoolId_idx" ON "CBTExamCandidate"("schoolId");

-- CreateIndex
CREATE INDEX "CBTExamCandidate_examId_idx" ON "CBTExamCandidate"("examId");

-- CreateIndex
CREATE INDEX "CBTExamCandidate_studentId_idx" ON "CBTExamCandidate"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CBTExamCandidate_examId_studentId_key" ON "CBTExamCandidate"("examId", "studentId");

-- CreateIndex
CREATE INDEX "CBTAttempt_schoolId_idx" ON "CBTAttempt"("schoolId");

-- CreateIndex
CREATE INDEX "CBTAttempt_examId_studentId_idx" ON "CBTAttempt"("examId", "studentId");

-- CreateIndex
CREATE INDEX "CBTAttempt_candidateId_idx" ON "CBTAttempt"("candidateId");

-- CreateIndex
CREATE INDEX "CBTAttempt_schoolId_status_idx" ON "CBTAttempt"("schoolId", "status");

-- CreateIndex
CREATE INDEX "CBTAttemptQuestion_attemptId_idx" ON "CBTAttemptQuestion"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "CBTAttemptQuestion_attemptId_questionId_key" ON "CBTAttemptQuestion"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "CBTAnswer_attemptId_idx" ON "CBTAnswer"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "CBTAnswer_attemptId_questionId_key" ON "CBTAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "CBTManualGrade_answerId_key" ON "CBTManualGrade"("answerId");

-- CreateIndex
CREATE INDEX "CBTManualGrade_answerId_idx" ON "CBTManualGrade"("answerId");

-- CreateIndex
CREATE INDEX "CBTSecurityEvent_attemptId_idx" ON "CBTSecurityEvent"("attemptId");

-- AddForeignKey
ALTER TABLE "CBTExamTypeOption" ADD CONSTRAINT "CBTExamTypeOption_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTQuestion" ADD CONSTRAINT "CBTQuestion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTQuestion" ADD CONSTRAINT "CBTQuestion_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTQuestion" ADD CONSTRAINT "CBTQuestion_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTQuestion" ADD CONSTRAINT "CBTQuestion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTQuestion" ADD CONSTRAINT "CBTQuestion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTQuestionOption" ADD CONSTRAINT "CBTQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CBTQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTQuestionTag" ADD CONSTRAINT "CBTQuestionTag_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTQuestionTagAssignment" ADD CONSTRAINT "CBTQuestionTagAssignment_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CBTQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTQuestionTagAssignment" ADD CONSTRAINT "CBTQuestionTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CBTQuestionTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTExam" ADD CONSTRAINT "CBTExam_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTExam" ADD CONSTRAINT "CBTExam_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "CBTExamTypeOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTExam" ADD CONSTRAINT "CBTExam_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTExam" ADD CONSTRAINT "CBTExam_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTExam" ADD CONSTRAINT "CBTExam_assessmentComponentId_fkey" FOREIGN KEY ("assessmentComponentId") REFERENCES "AssessmentComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTExam" ADD CONSTRAINT "CBTExam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTExam" ADD CONSTRAINT "CBTExam_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTExamQuestion" ADD CONSTRAINT "CBTExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "CBTExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTExamQuestion" ADD CONSTRAINT "CBTExamQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CBTQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTExamBlueprint" ADD CONSTRAINT "CBTExamBlueprint_examId_fkey" FOREIGN KEY ("examId") REFERENCES "CBTExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTExamBlueprintRule" ADD CONSTRAINT "CBTExamBlueprintRule_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "CBTExamBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTExamCandidate" ADD CONSTRAINT "CBTExamCandidate_examId_fkey" FOREIGN KEY ("examId") REFERENCES "CBTExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTExamCandidate" ADD CONSTRAINT "CBTExamCandidate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTExamCandidate" ADD CONSTRAINT "CBTExamCandidate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTExamCandidate" ADD CONSTRAINT "CBTExamCandidate_extensionGrantedById_fkey" FOREIGN KEY ("extensionGrantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTAttempt" ADD CONSTRAINT "CBTAttempt_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTAttempt" ADD CONSTRAINT "CBTAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "CBTExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTAttempt" ADD CONSTRAINT "CBTAttempt_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CBTExamCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTAttempt" ADD CONSTRAINT "CBTAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTAttemptQuestion" ADD CONSTRAINT "CBTAttemptQuestion_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "CBTAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTAttemptQuestion" ADD CONSTRAINT "CBTAttemptQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CBTQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTAnswer" ADD CONSTRAINT "CBTAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "CBTAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTAnswer" ADD CONSTRAINT "CBTAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CBTQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTManualGrade" ADD CONSTRAINT "CBTManualGrade_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "CBTAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTManualGrade" ADD CONSTRAINT "CBTManualGrade_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTSecurityEvent" ADD CONSTRAINT "CBTSecurityEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "CBTAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

