-- CreateEnum
CREATE TYPE "InvitePurpose" AS ENUM ('ACCOUNT_INVITATION', 'PASSWORD_SETUP');

-- AlterEnum
ALTER TYPE "ImportDataType" ADD VALUE 'STAFF';

-- AlterTable
ALTER TABLE "StaffInvite" ADD COLUMN     "purpose" "InvitePurpose" NOT NULL DEFAULT 'ACCOUNT_INVITATION',
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "department" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "staffId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_schoolId_staffId_key" ON "User"("schoolId", "staffId");

-- AddForeignKey
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

