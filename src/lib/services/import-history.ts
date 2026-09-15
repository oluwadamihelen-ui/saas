import "server-only";
import { prisma } from "@/lib/db";
import type { ImportDataType, ImportStatus } from "@/generated/prisma/client";

export interface RecordImportBatchInput {
  dataType: ImportDataType;
  status: ImportStatus;
  fileName: string;
  totalRows: number;
  successCount: number;
  failedCount: number;
  /// Capped at 200 rows — enough for a school to find and fix the bad
  /// rows in a large spreadsheet without this column growing unbounded.
  rowErrors?: { rowNumber: number; error: string }[];
  academicSessionId?: string | null;
  termId?: string | null;
  classArmId?: string | null;
}

export async function recordImportBatch(schoolId: string, importedById: string, input: RecordImportBatchInput) {
  return prisma.importBatch.create({
    data: {
      schoolId,
      importedById,
      dataType: input.dataType,
      status: input.status,
      fileName: input.fileName,
      totalRows: input.totalRows,
      successCount: input.successCount,
      failedCount: input.failedCount,
      rowErrors: input.rowErrors && input.rowErrors.length > 0 ? input.rowErrors.slice(0, 200) : undefined,
      academicSessionId: input.academicSessionId ?? null,
      termId: input.termId ?? null,
      classArmId: input.classArmId ?? null,
    },
  });
}

const PAGE_SIZE = 20;

export async function listImportBatches(schoolId: string, page = 1) {
  const currentPage = Math.max(1, page);
  const where = { schoolId };
  const [batches, total] = await Promise.all([
    prisma.importBatch.findMany({
      where,
      include: {
        importedBy: { select: { name: true } },
        academicSession: { select: { name: true } },
        term: { select: { name: true } },
        classArm: { include: { classGroup: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.importBatch.count({ where }),
  ]);
  return { batches, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getImportBatch(schoolId: string, id: string) {
  return prisma.importBatch.findFirst({ where: { schoolId, id } });
}
