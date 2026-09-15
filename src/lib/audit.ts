import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function logAudit(entry: {
  /// Null for a platform-wide action with no single tenant (e.g. a Super
  /// Admin editing the shared plan catalog) — the column itself is
  /// nullable for exactly this case.
  schoolId: string | null;
  /// Null for a system/webhook-triggered event with no human actor (e.g.
  /// a Partner Program commission created automatically the moment a
  /// payment is confirmed) — the column has always been nullable at the
  /// DB level; this type just catches up to it.
  userId: string | null;
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
