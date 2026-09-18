-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'LIBRARY_BOOKS_OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE 'TRANSPORT_STUDENT_UNASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYROLL_RUN_READY_FOR_APPROVAL';
ALTER TYPE "NotificationType" ADD VALUE 'PAYSLIP_AVAILABLE';
ALTER TYPE "NotificationType" ADD VALUE 'STAFF_INVITE_PENDING';
