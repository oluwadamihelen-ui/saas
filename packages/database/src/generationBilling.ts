import type { Prisma } from "@prisma/client";
import { getOrCreateWallet, recordWalletTransaction, isUniqueConstraintViolation } from "./wallet.js";

export class InsufficientGenerationDoeError extends Error {
  constructor(required: number, available: number) {
    super(`This generation costs ${required} Doe — you have ${available} available. Buy more Doe, or wait for your plan's monthly refresh.`);
  }
}

/**
 * Charges Doe for one AI generation call (spec: metered generation, not
 * "unlimited"). Lives here, not apps/web, so the worker — where the actual
 * provider calls happen — can charge at the exact moment it's about to
 * spend real provider money, through the same ledger path everything else
 * uses.
 *
 * Spends a subscriber's plan-included Doe (PromotionalGrant, FIFO by
 * soonest-expiring) before their purchased/earned wallet balance — the
 * same spend-order as consumePromotionalCoins in apps/web, reimplemented
 * here rather than imported because the worker cannot import from
 * apps/web/src/lib.
 *
 * Throws InsufficientGenerationDoeError and charges nothing if the
 * combined balance can't cover it — never partially charges.
 *
 * idempotencyKey should be stable across BullMQ retries of the *same*
 * generation attempt (e.g. `generation:${generationJobId}`) — a retry
 * that reaches this function again after already having charged once
 * hits the ledger's unique constraint and is treated as "already
 * charged, proceed" rather than charging twice.
 */
export async function chargeForGeneration(
  tx: Prisma.TransactionClient,
  params: { userId: string; doeAmount: number; referenceType: string; referenceId: string; idempotencyKey: string },
): Promise<void> {
  // Checked and short-circuited *before* touching any grant/wallet state —
  // a retry that reaches here after an earlier attempt already committed
  // must do nothing at all, not re-derive-then-discard a duplicate charge
  // (which would double-decrement the promotional grants it re-reads).
  const alreadyCharged = await tx.walletTransaction.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
  if (alreadyCharged) return;

  const wallet = await getOrCreateWallet(params.userId, tx);
  const grants = await tx.promotionalGrant.findMany({
    where: { userId: params.userId, remainingCoins: { gt: 0 }, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "asc" },
  });
  const availablePromotional = grants.reduce((sum, g) => sum + g.remainingCoins, 0);

  if (wallet.balance + availablePromotional < params.doeAmount) {
    throw new InsufficientGenerationDoeError(params.doeAmount, wallet.balance + availablePromotional);
  }

  let remaining = params.doeAmount;
  for (const grant of grants) {
    if (remaining <= 0) break;
    const consume = Math.min(grant.remainingCoins, remaining);
    await tx.promotionalGrant.update({ where: { id: grant.id }, data: { remainingCoins: { decrement: consume } } });
    remaining -= consume;
  }

  try {
    // Only the portion NOT already covered by promotional grants above
    // debits the wallet balance — `remaining` is what's left after that
    // loop. Still recorded even when it's 0 (fully covered by promotional
    // Doe), both for the audit trail and so the idempotency check above
    // has a row to find on a retry.
    await recordWalletTransaction(tx, {
      userId: params.userId,
      type: "GENERATION_SPEND",
      amount: -remaining,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      idempotencyKey: params.idempotencyKey,
      metadata: { doeAmount: params.doeAmount, promotionalDoeConsumed: params.doeAmount - remaining, walletDoeConsumed: remaining },
    });
  } catch (error) {
    // Lost the race against a concurrent attempt with the same key between
    // the check above and this insert — that attempt's charge is the one
    // that counts; ours must not also apply its grant decrements. Since
    // this whole function runs inside the caller's transaction, throwing
    // here rolls back everything this call did, including the decrements
    // above — exactly what "do nothing" requires when losing that race.
    if (isUniqueConstraintViolation(error, "idempotencyKey")) throw new AlreadyChargedError();
    throw error;
  }
}

/** Internal signal only — callers should catch this from their own transaction wrapper and treat it as a successful no-op, not a real failure. */
export class AlreadyChargedError extends Error {}

/**
 * Refunds a generation charge when the provider call itself fails after
 * being charged — the user never got the asset they paid for. Lands as
 * plain wallet balance (not restored to the original PromotionalGrant),
 * same simplification CoinPurchase refunds already make elsewhere.
 */
export async function refundGenerationCharge(
  tx: Prisma.TransactionClient,
  params: { userId: string; doeAmount: number; referenceType: string; referenceId: string },
): Promise<void> {
  await recordWalletTransaction(tx, {
    userId: params.userId,
    type: "GENERATION_REFUND",
    amount: params.doeAmount,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    metadata: { reason: "generation_failed" },
  });
}
