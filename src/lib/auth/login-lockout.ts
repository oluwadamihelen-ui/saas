import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/// Brute-force protection for src/auth.ts's Credentials `authorize`
/// callback: after MAX_FAILED_ATTEMPTS wrong passwords in a row, the
/// account cools down for LOCKOUT_MINUTES before another attempt is even
/// checked against bcrypt. Deliberately per-account (not per-IP — this
/// app has no separate rate-limiting infrastructure like Redis, and a
/// shared-IP school network must never lock out every family behind it)
/// — the standard trade-off for a credential-stuffing/guessing defense
/// with no new infrastructure. A locked account still returns the same
/// "invalid credentials" outcome as a wrong password, never a distinct
/// "locked" message, so a caller can't use this to enumerate which
/// accounts exist or are currently locked. Kept in its own module (no
/// NextAuth import) so it's testable without constructing the full
/// NextAuth config.
export const MAX_FAILED_ATTEMPTS = 8;
export const LOCKOUT_MINUTES = 15;

export async function checkPasswordWithLockout(
  candidateUser: { id: string; passwordHash: string; failedLoginCount: number; lockedUntil: Date | null },
  password: string
): Promise<boolean> {
  if (candidateUser.lockedUntil && candidateUser.lockedUntil > new Date()) return false;

  const valid = await bcrypt.compare(password, candidateUser.passwordHash);

  if (valid) {
    if (candidateUser.failedLoginCount > 0 || candidateUser.lockedUntil) {
      await prisma.user.update({ where: { id: candidateUser.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    }
    return true;
  }

  const nextCount = candidateUser.failedLoginCount + 1;
  const locking = nextCount >= MAX_FAILED_ATTEMPTS;
  await prisma.user.update({
    where: { id: candidateUser.id },
    data: {
      failedLoginCount: locking ? 0 : nextCount,
      lockedUntil: locking ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : undefined,
    },
  });
  return false;
}
