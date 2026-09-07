import { prisma } from "@/lib/db";

interface AuditEntry {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}

export async function recordAuditLog(entry: AuditEntry) {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      oldValue: entry.oldValue as never,
      newValue: entry.newValue as never,
      ipAddress: entry.ipAddress ?? null,
    },
  });
}
