-- AlterTable
ALTER TABLE "FeeStructure" ADD COLUMN     "isOptional" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "isIncluded" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isOptional" BOOLEAN NOT NULL DEFAULT false;
