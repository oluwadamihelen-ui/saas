import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { recordAuditLog } from "@/lib/security/audit";
import { emailUser } from "./notifications";

/**
 * Self-service password change for the logged-in user (any role, hotel
 * staff or Super Admin) -- requires the current password, so it works
 * without a token-based email reset flow (see ARCHITECTURE.md "What's
 * Deliberately Not Built Yet" for that separate, larger feature). A
 * security-notice email on every change is sent regardless, via Brevo.
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash) throw new Error("This account has no password set.");

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new Error("Current password is incorrect.");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await recordAuditLog({ hotelId: null, actorId: userId, action: "account.password_changed", resourceType: "User", resourceId: userId });
  if (user.email) {
    await emailUser(
      { email: user.email, name: user.name },
      { type: "account.password_changed", title: "Your password was changed", message: "Your Otelum account password was just changed. If this wasn't you, contact your hotel administrator immediately." }
    );
  }
}

export async function updateOwnProfile(userId: string, input: { name: string; phone?: string }) {
  return prisma.user.update({ where: { id: userId }, data: { name: input.name, phone: input.phone || null } });
}

/**
 * Lets someone with staff.manage permission set a new temporary password
 * for a staff member who's locked out -- the practical, buildable-today
 * substitute for an email-based "forgot password" flow (no email provider
 * is wired up yet). Scoped to the acting hotel so an Owner/Manager can only
 * reset passwords for staff at their own hotel.
 */
export async function resetMemberPassword(hotelId: string, actorId: string, memberId: string, newPassword: string) {
  const member = await prisma.hotelMember.findFirst({ where: { id: memberId, hotelId }, include: { user: true } });
  if (!member) throw new Error("Staff member not found");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: member.userId }, data: { passwordHash } });
  await recordAuditLog({ hotelId, actorId, action: "staff.password_reset", resourceType: "User", resourceId: member.userId });
  if (member.user.email) {
    await emailUser(
      { email: member.user.email, name: member.user.name },
      { type: "account.password_reset", title: "Your password was reset", message: "A manager at your hotel just reset your Otelum password. Ask them for your new password to sign in." }
    );
  }
}
