-- DropForeignKey
ALTER TABLE "CBTAnswer" DROP CONSTRAINT "CBTAnswer_questionId_fkey";

-- DropForeignKey
ALTER TABLE "CBTAttemptQuestion" DROP CONSTRAINT "CBTAttemptQuestion_questionId_fkey";

-- DropForeignKey
ALTER TABLE "CBTExamQuestion" DROP CONSTRAINT "CBTExamQuestion_questionId_fkey";

-- AddForeignKey
ALTER TABLE "CBTExamQuestion" ADD CONSTRAINT "CBTExamQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CBTQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTAttemptQuestion" ADD CONSTRAINT "CBTAttemptQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CBTQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CBTAnswer" ADD CONSTRAINT "CBTAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "CBTQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

