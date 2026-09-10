-- DropForeignKey
ALTER TABLE "CBTManualGrade" DROP CONSTRAINT "CBTManualGrade_gradedById_fkey";

-- AddForeignKey
ALTER TABLE "CBTManualGrade" ADD CONSTRAINT "CBTManualGrade_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

