import { hashPassword } from "@cinerra/config";
import { prisma } from "./db";

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account with that email already exists.");
  }
}

export async function createUserAccount(params: { name: string; email: string; password: string }) {
  const normalizedEmail = params.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw new EmailAlreadyRegisteredError();

  const freePlan = await prisma.plan.findUnique({ where: { key: "free" } });

  return prisma.user.create({
    data: {
      name: params.name,
      email: normalizedEmail,
      passwordHash: hashPassword(params.password),
      ...(freePlan ? { subscription: { create: { planId: freePlan.id, status: "ACTIVE", interval: "MONTH" } } } : {}),
    },
  });
}
