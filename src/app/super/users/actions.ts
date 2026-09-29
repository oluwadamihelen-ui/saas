"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/require";
import { recordAuditLog } from "@/lib/security/audit";

export async function setUserStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED") {
  const actor = await requireSuperAdmin();
  await prisma.user.update({ where: { id: userId }, data: { status } });
  await recordAuditLog({ hotelId: null, actorId: actor.id, action: "platform_user.status_changed", resourceType: "User", resourceId: userId, newValue: { status } });
  revalidatePath("/super/users");
}
