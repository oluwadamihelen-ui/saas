import { prisma } from "@/lib/db";
import { recordAuditLog } from "@/lib/security/audit";

/**
 * Staff and Super Admin accounts have their own dedicated management
 * surface (Admin -> Staff), with permission overrides and a role that
 * grants elevated access. Nothing here may touch those roles -- this
 * service only ever moves a user between the two "ordinary" platform
 * roles (buyer and developer/seller) or toggles their active status.
 */
const MANAGEABLE_ROLES = new Set(["CUSTOMER", "DEVELOPER"]);

async function requireManageableTarget(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user) throw new Error("User not found.");
  if (!MANAGEABLE_ROLES.has(user.role.key)) {
    throw new Error("Staff and admin accounts are managed from Admin → Staff, not here.");
  }
  return user;
}

export async function promoteToDeveloper(actorId: string, userId: string) {
  const user = await requireManageableTarget(userId);
  if (user.role.key === "DEVELOPER") return user;

  const developerRole = await prisma.role.findUniqueOrThrow({ where: { key: "DEVELOPER" } });
  const updated = await prisma.user.update({ where: { id: userId }, data: { roleId: developerRole.id } });

  await recordAuditLog({
    actorId,
    action: "user.promoted_to_developer",
    resourceType: "User",
    resourceId: userId,
    oldValue: { role: user.role.key },
    newValue: { role: "DEVELOPER" },
  });

  return updated;
}

export async function revertToCustomer(actorId: string, userId: string) {
  const user = await requireManageableTarget(userId);
  if (user.role.key === "CUSTOMER") return user;

  const customerRole = await prisma.role.findUniqueOrThrow({ where: { key: "CUSTOMER" } });
  const updated = await prisma.user.update({ where: { id: userId }, data: { roleId: customerRole.id } });

  await recordAuditLog({
    actorId,
    action: "user.reverted_to_customer",
    resourceType: "User",
    resourceId: userId,
    oldValue: { role: user.role.key },
    newValue: { role: "CUSTOMER" },
  });

  return updated;
}

export async function suspendPlatformUser(actorId: string, userId: string) {
  await requireManageableTarget(userId);
  const updated = await prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
  await recordAuditLog({ actorId, action: "user.suspended", resourceType: "User", resourceId: userId });
  return updated;
}

export async function reactivatePlatformUser(actorId: string, userId: string) {
  await requireManageableTarget(userId);
  const updated = await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
  await recordAuditLog({ actorId, action: "user.reactivated", resourceType: "User", resourceId: userId });
  return updated;
}
