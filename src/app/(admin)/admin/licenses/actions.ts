"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAuditLog } from "@/lib/security/audit";

export async function setLicenseStatus(licenseId: string, status: "ACTIVE" | "SUSPENDED" | "REVOKED") {
  const admin = await requirePermission(PERMISSIONS.APPLICATIONS_MANAGE);
  const before = await prisma.applicationLicense.findUniqueOrThrow({ where: { id: licenseId } });

  await prisma.applicationLicense.update({ where: { id: licenseId }, data: { status } });
  await recordAuditLog({
    actorId: admin.id,
    action: "license.status_changed",
    resourceType: "ApplicationLicense",
    resourceId: licenseId,
    oldValue: { status: before.status },
    newValue: { status },
  });

  revalidatePath("/admin/licenses");
}
