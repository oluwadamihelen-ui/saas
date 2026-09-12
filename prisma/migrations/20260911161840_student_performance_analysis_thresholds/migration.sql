-- AlterTable
ALTER TABLE "School" ADD COLUMN     "attendanceConcernThreshold" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN     "performanceFailedSubjectConcernThreshold" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "performancePassMark" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "performanceSignificantChangePoints" INTEGER NOT NULL DEFAULT 10;
