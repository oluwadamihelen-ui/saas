import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendSchoolEmail, absoluteUrl } from "@/lib/notification-delivery/send-email";

const RESET_TTL_MINUTES = 60;

/// Self-service "forgot password". Always resolves the same way regardless
/// of whether the email matches a real, active, school-scoped account —
/// never reveals account existence to the caller (standard anti-enumeration
/// practice for a public form). A student who logs in with their admission
/// number instead of an email (see the "Student login" tab on /login) has
/// no reachable inbox for this flow either way, so this only ever really
/// helps staff and parent accounts, which is the common case.
export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, schoolId: true, name: true, status: true },
  });
  if (!user || !user.schoolId || user.status !== "ACTIVE") return;

  // Any earlier unused link becomes invalid the moment a new one is
  // requested, so only the most recently emailed link ever works.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(24).toString("hex");
  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000) },
  });

  await sendSchoolEmail(user.schoolId, {
    to: normalizedEmail,
    subject: "Reset your password",
    title: "Reset your password",
    body: `${user.name}, we received a request to reset your password. This link expires in ${RESET_TTL_MINUTES} minutes. If you didn't request this, you can safely ignore this email — your password will stay the same.`,
    actionLabel: "Reset password",
    actionUrl: absoluteUrl(`/reset-password/${token}`),
  }).catch((err) => console.error("requestPasswordReset: email failed", err));
}

export async function getValidPasswordResetToken(token: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;
  return record;
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const record = await getValidPasswordResetToken(token);
  if (!record) throw new Error("This reset link is invalid or has expired.");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
}
