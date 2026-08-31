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
 * Fixed questions asked once, when a business first adds a payout bank
 * account. After that, the account is immutable from the dashboard — the
 * only way to change it is a PayoutAccountChangeRequest, and correctly
 * reproducing these answers (alongside the current password) is what's
 * required just to submit one, before support ever gets involved.
 */
export const SECURITY_QUESTIONS = [
  "What is the name of your very first customer or supplier?",
  "In what city or town did you start this business?",
  "What is the name of a close family member who helps with this business (or would notice if something was wrong)?",
] as const;

function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function hashSecurityAnswer(answer: string): Promise<string> {
  return bcrypt.hash(normalizeAnswer(answer), 10);
}

export async function verifySecurityAnswer(answer: string, hash: string): Promise<boolean> {
  return bcrypt.compare(normalizeAnswer(answer), hash);
}

/**
 * Checks every submitted answer against the business's stored hashes.
 * Returns false the moment any one doesn't match, or if the business hasn't
 * set up security questions at all (a legacy account from before this
 * feature existed) — in that case only support can hand-verify a change.
 */
export async function verifyAllSecurityAnswers(
  businessId: string,
  answers: string[]
): Promise<boolean> {
  const stored = await prisma.securityAnswer.findMany({ where: { businessId } });
  if (stored.length !== SECURITY_QUESTIONS.length || answers.length !== SECURITY_QUESTIONS.length) {
    return false;
  }
  const byQuestion = new Map(stored.map((s) => [s.question, s.answerHash]));
  for (let i = 0; i < SECURITY_QUESTIONS.length; i++) {
    const hash = byQuestion.get(SECURITY_QUESTIONS[i]);
    if (!hash) return false;
    if (!(await verifySecurityAnswer(answers[i], hash))) return false;
  }
  return true;
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

export type WalletSecurityAction =
  | "BANK_ACCOUNT_ADDED"
  | "BANK_ACCOUNT_CHANGED"
  | "WITHDRAWAL_REQUESTED"
  | "PAYOUT_CHANGE_REQUESTED"
  | "PAYOUT_CHANGE_DENIED"
  | "PAYOUT_CHANGE_APPROVED"
  | "PAYOUT_CHANGE_REJECTED";

export async function logWalletSecurityEvent(
  businessId: string,
  userId: string,
  action: WalletSecurityAction,
  metadata: Record<string, unknown>,
  ipAddress?: string
) {
  await prisma.auditLog.create({
    data: { businessId, userId, action, entityType: "BankAccount", metadata: metadata as never, ipAddress },
  });

  const titles: Record<WalletSecurityAction, string> = {
    BANK_ACCOUNT_ADDED: "Payout account added",
    BANK_ACCOUNT_CHANGED: "Payout account changed",
    WITHDRAWAL_REQUESTED: "Withdrawal requested",
    PAYOUT_CHANGE_REQUESTED: "Payout account change requested",
    PAYOUT_CHANGE_DENIED: "Payout account change attempt failed",
    PAYOUT_CHANGE_APPROVED: "Payout account change approved",
    PAYOUT_CHANGE_REJECTED: "Payout account change declined",
  };
  const bodies: Record<WalletSecurityAction, string> = {
    BANK_ACCOUNT_ADDED: `A payout bank account was added to your wallet (${metadata.accountNumber ?? ""}). If this wasn't you, contact support immediately.`,
    BANK_ACCOUNT_CHANGED: `Your wallet's payout bank account was changed to ${metadata.accountNumber ?? "a new account"}. Withdrawals are locked for ${WITHDRAWAL_LOCK_HOURS}h as a safety window. If this wasn't you, contact support immediately.`,
    WITHDRAWAL_REQUESTED: `A withdrawal of ${metadata.amount ?? ""} was requested from your wallet. If this wasn't you, contact support immediately.`,
    PAYOUT_CHANGE_REQUESTED: `A request to change your payout account to ${metadata.accountNumber ?? "a new account"} was submitted. It will only take effect once our support team reviews and approves it. If this wasn't you, contact support immediately.`,
    PAYOUT_CHANGE_DENIED: `Someone tried to submit a payout account change but the password or security answers didn't match. If this wasn't you, your account may be at risk — contact support immediately.`,
    PAYOUT_CHANGE_APPROVED: `Your payout account change was approved and is now active (${metadata.accountNumber ?? ""}). Withdrawals are locked for ${WITHDRAWAL_LOCK_HOURS}h as a safety window.`,
    PAYOUT_CHANGE_REJECTED: `Your payout account change request was declined${metadata.reviewNote ? `: ${metadata.reviewNote}` : "."} Contact support if you have questions.`,
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
