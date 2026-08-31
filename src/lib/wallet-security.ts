import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { TenantError } from "@/lib/errors";

/**
 * Re-confirms the acting user's password before a sensitive wallet action
 * (adding/changing a payout bank account, requesting a withdrawal). This is
 * the main defense against a hijacked session or an unattended logged-in
 * browser being used to redirect a merchant's money — a stolen cookie
 * alone is not enough once this check is in place.
 */
export async function requireCurrentPassword(userId: string, password: string | undefined): Promise<void> {
  if (!password) {
    throw new TenantError("Re-enter your password to continue", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user?.passwordHash) {
    // Google-only accounts have no password to check against. Rather than
    // silently skipping verification, block the action with a clear reason.
    throw new TenantError(
      "Set a password on your account (Settings) before you can manage payout details",
      403
    );
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new TenantError("Incorrect password", 401);
  }
}

export function maskAccountNumber(accountNumber: string): string {
  return accountNumber.length <= 4 ? accountNumber : `${"*".repeat(accountNumber.length - 4)}${accountNumber.slice(-4)}`;
}

/**
 * Soft fraud signal, never a hard block: does the name Paystack resolved
 * for this account share any word with the business's registered owner
 * name or business name? A legitimate merchant sometimes withdraws to a
 * partner's or relative's account, so a mismatch is surfaced to the
 * merchant as a warning to confirm, not refused outright.
 */
export function accountNameLikelyMatches(resolvedName: string, ...candidates: string[]): boolean {
  const resolvedWords = normalizeWords(resolvedName);
  return candidates.some((candidate) => {
    const candidateWords = normalizeWords(candidate);
    return candidateWords.some((w) => resolvedWords.includes(w));
  });
}

function normalizeWords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

const WITHDRAWAL_LOCK_HOURS = 24;

export function computeLockedUntil(): Date {
  return new Date(Date.now() + WITHDRAWAL_LOCK_HOURS * 60 * 60 * 1000);
}

export async function logWalletSecurityEvent(
  businessId: string,
  userId: string,
  action: "BANK_ACCOUNT_ADDED" | "BANK_ACCOUNT_CHANGED" | "WITHDRAWAL_REQUESTED",
  metadata: Record<string, unknown>,
  ipAddress?: string
) {
  await prisma.auditLog.create({
    data: { businessId, userId, action, entityType: "BankAccount", metadata: metadata as never, ipAddress },
  });

  const titles: Record<typeof action, string> = {
    BANK_ACCOUNT_ADDED: "Payout account added",
    BANK_ACCOUNT_CHANGED: "Payout account changed",
    WITHDRAWAL_REQUESTED: "Withdrawal requested",
  };
  const bodies: Record<typeof action, string> = {
    BANK_ACCOUNT_ADDED: `A payout bank account was added to your wallet (${metadata.accountNumber ?? ""}). If this wasn't you, contact support immediately.`,
    BANK_ACCOUNT_CHANGED: `Your wallet's payout bank account was changed to ${metadata.accountNumber ?? "a new account"}. Withdrawals are locked for ${WITHDRAWAL_LOCK_HOURS}h as a safety window. If this wasn't you, contact support immediately.`,
    WITHDRAWAL_REQUESTED: `A withdrawal of ${metadata.amount ?? ""} was requested from your wallet. If this wasn't you, contact support immediately.`,
  };

  await prisma.notification.create({
    data: {
      businessId,
      userId,
      type: "SECURITY_ALERT",
      title: titles[action],
      body: bodies[action],
      metadata: metadata as never,
    },
  });
}
