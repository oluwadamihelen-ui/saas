import { prisma } from "@/server/db/client";
import type { CreditReason } from "@/generated/prisma/enums";

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

/**
 * Applies a signed credit delta atomically and records the ledger entry.
 * Negative amounts (debits) throw InsufficientCreditsError if the balance
 * would go below zero — callers should surface this to the user as
 * "not enough credits" rather than let an operation run uncharged.
 */
export async function applyCreditDelta(
  userId: string,
  amount: number,
  reason: CreditReason,
  metadata?: Record<string, unknown>
) {
  return prisma.$transaction(async (tx) => {
    const balance = await tx.creditBalance.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: {},
    });

    const nextBalance = balance.balance + amount;
    if (nextBalance < 0) {
      throw new InsufficientCreditsError();
    }

    await tx.creditBalance.update({
      where: { userId },
      data: { balance: nextBalance },
    });

    await tx.creditLedgerEntry.create({
      data: {
        userId,
        amount,
        reason,
        balanceAfter: nextBalance,
        metadata: metadata as never,
      },
    });

    return nextBalance;
  });
}

export async function getCreditBalance(userId: string): Promise<number> {
  const balance = await prisma.creditBalance.findUnique({ where: { userId } });
  return balance?.balance ?? 0;
}
