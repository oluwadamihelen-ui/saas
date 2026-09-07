import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function logAudit(entry: {
  schoolId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  previousValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
}) {
  await prisma.auditLog.create({
    data: {
      schoolId: entry.schoolId,
      userId: entry.userId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      previousValue: entry.previousValue ?? undefined,
      newValue: entry.newValue ?? undefined,
    },
  });
}
