import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

export const hasDb = !!process.env.TEST_DATABASE_URL;

export async function makeUser(over: Record<string, unknown> = {}) {
  return prisma.user.create({ data: { email: `t-${randomUUID()}@test.local`, passwordHash: "x", onboardedAt: new Date(), ...over } });
}

export async function makeAccount(userId: string, over: Record<string, unknown> = {}) {
  return prisma.account.create({
    data: { userId, name: "Test", currency: "USD", startingBalance: 1000, riskSettings: { create: {} }, ...over },
    include: { riskSettings: true },
  });
}

export async function cleanup(userIds: string[]) {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
