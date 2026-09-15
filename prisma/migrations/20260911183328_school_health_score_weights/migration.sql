-- AlterTable
ALTER TABLE "School" ADD COLUMN     "healthScoreWeightAcademic" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "healthScoreWeightAttendance" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "healthScoreWeightFinancial" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "healthScoreWeightOperational" INTEGER NOT NULL DEFAULT 20;
