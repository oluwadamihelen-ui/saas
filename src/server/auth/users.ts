import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/client";
import { applyCreditDelta } from "@/server/credits/ledger";
import { SIGNUP_GRANT_CREDITS } from "@/lib/plans";

export async function createUserWithPassword(params: {
  name: string;
  email: string;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(params.password, 12);

  const user = await prisma.user.create({
    data: {
      name: params.name,
      email: params.email,
      passwordHash,
      creditBalance: { create: { balance: 0 } },
    },
  });

  await applyCreditDelta(user.id, SIGNUP_GRANT_CREDITS, "SIGNUP_GRANT");

  return user;
}
