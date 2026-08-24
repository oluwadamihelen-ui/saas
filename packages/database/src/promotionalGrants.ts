import { prisma } from "./index.js";
import { getOrCreateWallet, recordWalletTransaction } from "./wallet.js";

/**
 * The worker's promotional-expiration job body. Lives here (not
 * apps/web) because the worker can't import from apps/web/src/lib — and
 * because it needs the exact same recordWalletTransaction the rest of the
 * ledger goes through, not a duplicated copy.
 *
 * Debits at most min(remainingCoins, current wallet balance) — never
 * drives the balance negative. This is deliberately different from the
 * refund/reversal precedent elsewhere in this codebase (which *does*
 * allow going negative, because that represents a real debt from a
 * fraud/chargeback reversal): expiring an unused promotional credit is
 * reclaiming something the platform gave away for free and the user
 * never used, not collecting on money they already spent.
 */
export async function expirePromotionalGrants(): Promise<number> {
  const expired = await prisma.promotionalGrant.findMany({
    where: { expiresAt: { lte: new Date() }, expiredAt: null },
  });

  let processed = 0;
  for (const grant of expired) {
    await prisma.$transaction(async (tx) => {
      const wallet = await getOrCreateWallet(grant.userId, tx);
      const debitAmount = Math.min(grant.remainingCoins, wallet.balance);
      if (debitAmount > 0) {
        await recordWalletTransaction(tx, {
          userId: grant.userId,
          type: "ADJUSTMENT",
          amount: -debitAmount,
          referenceType: "PromotionalGrant",
          referenceId: grant.id,
          idempotencyKey: `promo-expire:${grant.id}`,
          metadata: { reason: "promotional_coins_expired" },
        });
      }
      await tx.promotionalGrant.update({ where: { id: grant.id }, data: { remainingCoins: 0, expiredAt: new Date() } });
    });
    processed++;
  }
  return processed;
}
