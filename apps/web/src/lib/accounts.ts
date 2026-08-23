import { hashPassword, verifyPassword } from "@cinerra/config";
import { prisma } from "./db";

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

  return prisma.user.create({
    data: {
      name: params.name,
      email: normalizedEmail,
      passwordHash: hashPassword(params.password),
      termsAcceptedAt: new Date(),
      ...(freePlan ? { subscription: { create: { planId: freePlan.id, status: "ACTIVE", interval: "MONTH" } } } : {}),
    },
  });
}
