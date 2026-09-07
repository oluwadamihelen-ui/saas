"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAuditLog } from "@/lib/security/audit";

export async function markCommissionPaid(commissionId: string) {
  const admin = await requirePermission(PERMISSIONS.APPLICATIONS_MANAGE);
  const commission = await prisma.commission.findUniqueOrThrow({ where: { id: commissionId } });
  if (commission.status === "PAID") return;

  await prisma.commission.update({ where: { id: commissionId }, data: { status: "PAID", paidAt: new Date() } });
  await recordAuditLog({
    actorId: admin.id,
    action: "commission.paid",
    resourceType: "Commission",
    resourceId: commissionId,
    newValue: { amount: Number(commission.amount) },
  });

  revalidatePath("/admin/commissions");
}
