import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getEmailProvider } from "@/lib/providers/registry";
import { recordAuditLog } from "@/lib/security/audit";
import { logger } from "@/lib/security/logger";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Always resolves regardless of whether the email matches a real, active
 * account -- the caller must show the same generic "check your email"
 * message either way, or this becomes an account-enumeration oracle. Only
 * a genuine match actually creates a token or sends anything.
 */
export async function requestPasswordReset(email: string, appOrigin: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || user.status !== "ACTIVE" || !user.passwordHash) {
    logger.info("password_reset.requested_unknown_or_inactive", { email: normalizedEmail });
    return;
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

  const resetUrl = `${appOrigin}/reset-password?token=${rawToken}`;
  const emailProvider = await getEmailProvider();
  await emailProvider.send({
    to: user.email,
    subject: "Reset your BridgeCodes password",
    html: `<p>Hi ${user.name},</p><p>Someone requested a password reset for your BridgeCodes account. This link expires in 1 hour and can only be used once.</p><p><a href="${resetUrl}">Reset your password</a></p><p>If you didn't request this, you can safely ignore this email -- your password hasn't changed.</p>`,
    text: `Reset your BridgeCodes password: ${resetUrl}\n\nThis link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email -- your password hasn't changed.`,
  });

  logger.info("password_reset.email_sent", { userId: user.id });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new Error("This password reset link is invalid or has expired. Please request a new one.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // A successful reset retires every outstanding link ever emailed for
    // this user, not just the one that got used -- an older, still-valid
    // link must not remain usable after the password has already changed.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  await recordAuditLog({ actorId: record.userId, action: "user.password_reset", resourceType: "User", resourceId: record.userId });
  logger.info("password_reset.completed", { userId: record.userId });
}
