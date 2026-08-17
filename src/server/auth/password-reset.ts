import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/client";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function createPasswordResetToken(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always behave the same whether or not the account exists, so the
  // response never leaks which emails are registered.
  if (!user) return null;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: tokenHash,
      expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  return rawToken;
}

export async function consumePasswordResetToken(email: string, rawToken: string, newPassword: string) {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token: tokenHash } },
  });

  if (!record || record.expires < new Date()) {
    return false;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { email }, data: { passwordHash } }),
    prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token: tokenHash } },
    }),
  ]);

  return true;
}
