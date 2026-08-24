import type { Prisma } from "@cinerra/database";
import { prisma } from "./db";
import { recordWalletTransaction } from "./wallet";

// The expiration job itself lives in packages/database (expirePromotionalGrants) —
// the worker can't import from apps/web/src/lib, so it lives where both
// this app and the worker can share the exact same code. Re-exported here
// so anything in this app wanting it (e.g. a future admin "run now"
// action) can still import it from this familiar path.
export { expirePromotionalGrants } from "@cinerra/database";

export class UserNotFoundError extends Error {
  constructor() {
    super("We couldn't find a user with that email.");
  }
}
export class InvalidGrantAmountError extends Error {
  constructor() {
    super("Grant amount must be a positive number of coins.");
  }
}

/**
 * Admin-initiated promotional coin grant — a real credit to the wallet
 * (WalletTransactionType.PROMOTIONAL_CREDIT existed in the schema with
 * nothing creating one), plus a PromotionalGrant row that tracks how much
 * of it is still unspent so it can actually expire later.
 */
export async function grantPromotionalCoins(params: {
  targetUserEmail: string;
  coins: number;
  expiresInDays: number;
  reason?: string;
  grantedByAdminId: string;
}): Promise<void> {
  if (params.coins <= 0) throw new InvalidGrantAmountError();

  const targetUser = await prisma.user.findUnique({ where: { email: params.targetUserEmail.toLowerCase() }, select: { id: true } });
  if (!targetUser) throw new UserNotFoundError();

  const expiresAt = new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    const grant = await tx.promotionalGrant.create({
      data: {
        userId: targetUser.id,
        coins: params.coins,
        remainingCoins: params.coins,
        expiresAt,
        reason: params.reason,
        grantedByAdminId: params.grantedByAdminId,
      },
    });
    await recordWalletTransaction(tx, {
      userId: targetUser.id,
      type: "PROMOTIONAL_CREDIT",
      amount: params.coins,
      referenceType: "PromotionalGrant",
      referenceId: grant.id,
      idempotencyKey: `promo-grant:${grant.id}`,
      metadata: { reason: params.reason ?? null, expiresAt: expiresAt.toISOString() },
    });
  });
}

/**
 * Bookkeeping-only side effect, called right after a real CONTENT_UNLOCK
 * debit inside the same transaction — decrements whichever active grants
 * are soonest to expire first ("use it or lose it"), so expiration has
 * something accurate to act on later. Never gates or redirects the actual
 * spend: Wallet.balance is debited the normal way regardless of whether
 * the user has any promotional coins at all.
 *
 * Deliberately not symmetric with reverseContentUnlock: a later reversal
 * does not restore consumed promotional coins. Admin-only, rare operation;
 * treating a used promotional credit as spent (not refundable) even if the
 * underlying purchase is separately reversed is a documented
 * simplification, not an oversight.
 */
export async function consumePromotionalCoins(tx: Prisma.TransactionClient, userId: string, amount: number): Promise<void> {
  let remaining = amount;
  const grants = await tx.promotionalGrant.findMany({
    where: { userId, remainingCoins: { gt: 0 }, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "asc" },
  });
  for (const grant of grants) {
    if (remaining <= 0) break;
    const consume = Math.min(grant.remainingCoins, remaining);
    await tx.promotionalGrant.update({ where: { id: grant.id }, data: { remainingCoins: { decrement: consume } } });
    remaining -= consume;
  }
}
