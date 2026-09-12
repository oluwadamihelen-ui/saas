import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const ACCOUNTS_PAGE_SIZE = 20;

/// Every account on the school — staff and portal (parent/student) — unlike
/// listStaff in staff.ts, which deliberately excludes portal accounts since
/// it's the staff directory. This is the broader "every login this school
/// has issued" view the Administration > User > All Users page needs.
export async function listAllAccounts(schoolId: string, page = 1) {
  const currentPage = Math.max(1, page);
  const where = { schoolId };
  const [accounts, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { role: true },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * ACCOUNTS_PAGE_SIZE,
      take: ACCOUNTS_PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);
  return { accounts, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / ACCOUNTS_PAGE_SIZE)) };
}

/// Unpaginated, for the Reset Password user picker rather than the All
/// Users table — same "bounded, fine as a plain <select>" reasoning as
/// listAllStaff/listActiveStudentsBrief.
export async function listAllAccountsBrief(schoolId: string) {
  return prisma.user.findMany({
    where: { schoolId },
    select: { id: true, name: true, email: true, role: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function resetUserPassword(schoolId: string, userId: string, newPassword: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, schoolId } });
  if (!user) throw new Error("User not found.");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

/// Every check here runs server-side against data resolved from the
/// authenticated session/DB, never from anything the client sent except
/// the two ids — schoolId always comes from the caller's own session
/// (see requirePermission), and both the target user and the requested
/// role are re-resolved and ownership-checked against it here, not
/// trusted at face value.
///
/// SCHOOL_OWNER is immutable through this function in both directions —
/// it can never be assigned, and a user who currently holds it can never
/// be moved off it here — by design, not by a general role-hierarchy
/// system: this is the one rule this app needs (see the User Management
/// phase 2 design notes), so it's the one rule enforced. PARENT/STUDENT
/// (portal roles, tied to a Guardian/Student profile) and SUPER_ADMIN
/// (platform-level, schoolId null) are likewise never valid targets for
/// this staff-role-management action.
export async function changeUserRole(schoolId: string, actingUserId: string, targetUserId: string, newRoleId: string) {
  const target = await prisma.user.findFirst({ where: { id: targetUserId, schoolId }, include: { role: true } });
  if (!target) throw new Error("User not found.");
  if (target.role.key === "SCHOOL_OWNER") throw new Error("School Owner's role cannot be changed here.");
  if (["PARENT", "STUDENT"].includes(target.role.key)) throw new Error("Portal accounts don't have a staff role to change.");

  const newRole = await prisma.role.findFirst({ where: { id: newRoleId, schoolId } });
  if (!newRole) throw new Error("Select a valid role.");
  if (newRole.key === "SCHOOL_OWNER") throw new Error("School Owner cannot be assigned here.");
  if (["PARENT", "STUDENT"].includes(newRole.key)) throw new Error("Select a valid staff role.");
  if (newRole.id === target.roleId) throw new Error("That's already this user's role.");

  const updated = await prisma.user.update({ where: { id: targetUserId }, data: { roleId: newRoleId }, include: { role: true } });

  await logAudit({
    schoolId,
    userId: actingUserId,
    action: "staff.role_changed",
    resourceType: "User",
    resourceId: targetUserId,
    previousValue: { roleId: target.roleId, roleName: target.role.name },
    newValue: { roleId: newRole.id, roleName: newRole.name },
  });

  return updated;
}

/// Same immutability rule as changeUserRole: SCHOOL_OWNER can't be
/// suspended through this action.
export async function setUserStatus(schoolId: string, actingUserId: string, targetUserId: string, status: "ACTIVE" | "SUSPENDED") {
  const target = await prisma.user.findFirst({ where: { id: targetUserId, schoolId }, include: { role: true } });
  if (!target) throw new Error("User not found.");
  if (target.role.key === "SCHOOL_OWNER") throw new Error("School Owner cannot be suspended.");
  if (target.status === "INVITED") throw new Error("This account hasn't completed password setup yet.");

  const updated = await prisma.user.update({ where: { id: targetUserId }, data: { status } });

  await logAudit({
    schoolId,
    userId: actingUserId,
    action: status === "SUSPENDED" ? "staff.suspended" : "staff.reactivated",
    resourceType: "User",
    resourceId: targetUserId,
    previousValue: { status: target.status },
    newValue: { status },
  });

  return updated;
}
