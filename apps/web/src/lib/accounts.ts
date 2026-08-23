import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "@cinerra/config";
import { welcomeEmail, passwordResetEmail } from "@cinerra/email";
import { prisma } from "./db";
import { emailClient } from "./email";
import { env } from "./env";

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account with that email already exists.");
  }
}

export class TermsNotAcceptedError extends Error {
  constructor() {
    super("You must accept the Terms of Service and Privacy Policy to create an account.");
  }
}

export class IncorrectPasswordError extends Error {
  constructor() {
    super("Your current password is incorrect.");
  }
}

export class NoPasswordSetError extends Error {
  constructor() {
    super("This account doesn't have a password set — it signs in via a connected provider instead.");
  }
}

export class InvalidResetTokenError extends Error {
  constructor() {
    super("This password reset link is invalid or has expired.");
  }
}

export async function updateUserName(userId: string, name: string) {
  return prisma.user.update({ where: { id: userId }, data: { name } });
}

export async function changeUserPassword(params: { userId: string; currentPassword: string; newPassword: string }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: params.userId } });
  if (!user.passwordHash) throw new NoPasswordSetError();
  if (!verifyPassword(params.currentPassword, user.passwordHash)) throw new IncorrectPasswordError();

  await prisma.user.update({ where: { id: params.userId }, data: { passwordHash: hashPassword(params.newPassword) } });
}

export async function createUserAccount(params: { name: string; email: string; password: string; termsAccepted: boolean }) {
  if (!params.termsAccepted) throw new TermsNotAcceptedError();

  const normalizedEmail = params.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw new EmailAlreadyRegisteredError();

  const freePlan = await prisma.plan.findUnique({ where: { key: "free" } });

  const user = await prisma.user.create({
    data: {
      name: params.name,
      email: normalizedEmail,
      passwordHash: hashPassword(params.password),
      termsAcceptedAt: new Date(),
      ...(freePlan ? { subscription: { create: { planId: freePlan.id, status: "ACTIVE", interval: "MONTH" } } } : {}),
    },
  });

  // Best-effort — a failed or unconfigured email provider must never fail
  // account creation itself.
  emailClient
    .send({ to: user.email, ...welcomeEmail(user.name ?? "", `${env.APP_BASE_URL}/projects/new`) })
    .catch((err) => console.error("[email] Failed to send welcome email:", err));

  return user;
}

/** Never reveals whether the email is registered, or whether it's a password vs. OAuth account — always resolves the same way, to avoid email enumeration. */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user?.passwordHash) return;

  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS) },
  });

  const resetUrl = `${env.APP_BASE_URL}/reset-password?token=${token}`;
  await emailClient
    .send({ to: user.email, ...passwordResetEmail(resetUrl) })
    .catch((err) => console.error("[email] Failed to send password reset email:", err));
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    throw new InvalidResetTokenError();
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash: hashPassword(newPassword) } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);
}
