import { createPaystackClient, createKorapayClient } from "@cinerra/billing";
import type { PaymentProvider, Payout } from "@cinerra/database";
import { prisma } from "./db";
import { env } from "./env";

export class PayoutsNotConfiguredError extends Error {
  constructor(provider: PaymentProvider) {
    super(`Payouts via ${provider === "PAYSTACK" ? "Paystack" : "Korapay"} aren't available yet — it isn't configured on this server.`);
  }
}
export class NoPayoutAccountError extends Error {
  constructor() {
    super("Connect a payout account before requesting a withdrawal.");
  }
}
export class BelowPayoutMinimumError extends Error {
  constructor(
    public readonly minimum: number,
    public readonly available: number,
  ) {
    super(`You need at least ${minimum.toLocaleString()} Coins available to withdraw — you have ${available.toLocaleString()}.`);
  }
}
export class PayoutClaimConflictError extends Error {
  constructor() {
    super("Another payout request is already in progress for your account — please try again in a moment.");
  }
}
export class AccountResolutionFailedError extends Error {
  constructor() {
    super("We couldn't verify that bank account. Double-check the bank and account number and try again.");
  }
}

/** True for Prisma's write-conflict/serialization-failure error under a Serializable transaction — the losing side of a race, not a real failure. */
function isSerializationFailure(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2034";
}

export async function resolvePayoutAccountNumber(provider: PaymentProvider, bankCode: string, accountNumber: string): Promise<{ accountName: string }> {
  try {
    if (provider === "PAYSTACK") {
      if (!env.PAYSTACK_SECRET_KEY) throw new PayoutsNotConfiguredError("PAYSTACK");
      const result = await createPaystackClient(env.PAYSTACK_SECRET_KEY).resolveAccountNumber({ accountNumber, bankCode });
      return { accountName: result.account_name };
    }
    if (!env.KORAPAY_SECRET_KEY) throw new PayoutsNotConfiguredError("KORAPAY");
    const result = await createKorapayClient(env.KORAPAY_SECRET_KEY).resolveAccountNumber({ accountNumber, bankCode });
    return { accountName: result.account_name };
  } catch (error) {
    if (error instanceof PayoutsNotConfiguredError) throw error;
    throw new AccountResolutionFailedError();
  }
}

/**
 * Connects (or replaces) a creator's payout destination. The account name
 * is always re-resolved from the provider here — never trusts a name the
 * client might send — and for Paystack, a Transfer Recipient is created up
 * front so every future payout just reuses the stored recipient_code
 * rather than re-creating one per withdrawal.
 */
export async function connectPayoutAccount(userId: string, params: { provider: PaymentProvider; bankCode: string; accountNumber: string }) {
  const { accountName } = await resolvePayoutAccountNumber(params.provider, params.bankCode, params.accountNumber);

  let paystackRecipientCode: string | null = null;
  if (params.provider === "PAYSTACK") {
    const paystack = createPaystackClient(env.PAYSTACK_SECRET_KEY!);
    const recipient = await paystack.createTransferRecipient({ name: accountName, accountNumber: params.accountNumber, bankCode: params.bankCode });
    paystackRecipientCode = recipient.recipient_code;
  }

  return prisma.payoutAccount.upsert({
    where: { userId },
    create: { userId, provider: params.provider, bankCode: params.bankCode, accountNumber: params.accountNumber, accountName, paystackRecipientCode },
    update: { provider: params.provider, bankCode: params.bankCode, accountNumber: params.accountNumber, accountName, paystackRecipientCode },
  });
}

export async function getAvailablePayoutBalance(userId: string): Promise<{ coins: number; amountCents: number; currency: string }> {
  const [settings, available] = await Promise.all([
    prisma.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
    prisma.creatorEarning.aggregate({ where: { publisherId: userId, status: "AVAILABLE", payoutId: null }, _sum: { coins: true } }),
  ]);
  const coins = available._sum.coins ?? 0;
  return { coins, amountCents: coins * settings.payoutCoinValueCents, currency: settings.payoutCurrency };
}

/**
 * The DB-only half of requesting a payout: validates the minimum, creates
 * a PENDING Payout, and claims every currently-AVAILABLE, not-yet-claimed
 * CreatorEarning for this creator by linking payoutId — all inside one
 * Serializable transaction. Kept separate from the actual provider
 * Transfer/Disburse call (initiatePayoutTransfer) so a network failure can
 * never roll back money that's already conceptually "claimed", and so this
 * half stays independently testable without hitting a real payment API.
 *
 * Serializable isolation (not an idempotency-key unique constraint, unlike
 * every other race in this codebase) is the right tool here specifically
 * because the claim spans a *set* of CreatorEarning rows rather than a
 * single logical operation with one natural key to hang a unique
 * constraint off of — two concurrent withdrawal requests for the same
 * creator would otherwise both read the same "available" rows before
 * either commits. Postgres detects the conflict and aborts the losing
 * transaction with a serialization failure, which is surfaced here as
 * PayoutClaimConflictError.
 */
export async function claimEarningsForPayout(userId: string): Promise<Payout> {
  const account = await prisma.payoutAccount.findUnique({ where: { userId } });
  if (!account || !account.payoutsEnabled) throw new NoPayoutAccountError();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const settings = await tx.platformSettings.findUniqueOrThrow({ where: { id: "singleton" } });
        const available = await tx.creatorEarning.findMany({ where: { publisherId: userId, status: "AVAILABLE", payoutId: null } });
        const totalCoins = available.reduce((sum, e) => sum + e.coins, 0);
        if (totalCoins < settings.payoutMinimumCoins) throw new BelowPayoutMinimumError(settings.payoutMinimumCoins, totalCoins);

        const payout = await tx.payout.create({
          data: {
            publisherId: userId,
            coins: totalCoins,
            amountCents: totalCoins * settings.payoutCoinValueCents,
            currency: settings.payoutCurrency,
            status: "PENDING",
            provider: account.provider,
            providerReference: `payout:${userId}:${Date.now()}`,
          },
        });

        await tx.creatorEarning.updateMany({ where: { id: { in: available.map((e) => e.id) } }, data: { payoutId: payout.id } });

        return payout;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (isSerializationFailure(error)) throw new PayoutClaimConflictError();
    throw error;
  }
}

/**
 * The network half — calls the provider's real Transfer/Disburse API using
 * the payout's already-claimed amount and the creator's stored bank
 * details. On any failure (including the provider simply being
 * unconfigured), the Payout is marked FAILED and its claimed earnings are
 * released back to AVAILABLE so the creator can retry, rather than leaving
 * coins stuck in limbo attached to a payout that never went anywhere.
 */
export async function initiatePayoutTransfer(payoutId: string): Promise<void> {
  const payout = await prisma.payout.findUniqueOrThrow({ where: { id: payoutId } });
  const account = await prisma.payoutAccount.findUniqueOrThrow({ where: { userId: payout.publisherId } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: payout.publisherId } });

  try {
    if (payout.provider === "PAYSTACK") {
      if (!env.PAYSTACK_SECRET_KEY) throw new PayoutsNotConfiguredError("PAYSTACK");
      if (!account.paystackRecipientCode) throw new Error("Paystack payout account is missing its recipient code — reconnect the payout account.");
      const paystack = createPaystackClient(env.PAYSTACK_SECRET_KEY);
      const result = await paystack.initiateTransfer({
        amount: payout.amountCents,
        recipientCode: account.paystackRecipientCode,
        reference: payout.providerReference,
        reason: "FilmDoe creator payout",
      });
      await prisma.payout.update({ where: { id: payout.id }, data: { providerTransferId: result.transfer_code } });
    } else {
      if (!env.KORAPAY_SECRET_KEY) throw new PayoutsNotConfiguredError("KORAPAY");
      const korapay = createKorapayClient(env.KORAPAY_SECRET_KEY);
      // Korapay wants the MAJOR currency unit — same conversion coin
      // purchases already needed (see coinPurchases.ts).
      const majorAmount = payout.amountCents / 100;
      const result = await korapay.initiateDisbursement({
        amount: majorAmount,
        currency: payout.currency,
        reference: payout.providerReference,
        bankCode: account.bankCode,
        accountNumber: account.accountNumber,
        customerName: user.name ?? account.accountName,
        customerEmail: user.email,
        narration: "FilmDoe creator payout",
      });
      await prisma.payout.update({ where: { id: payout.id }, data: { providerTransferId: result.reference } });
    }
  } catch (error) {
    console.error(`[payouts] Failed to initiate transfer for payout ${payout.id}:`, error);
    await prisma.$transaction([
      prisma.payout.update({ where: { id: payout.id }, data: { status: "FAILED", failureReason: error instanceof Error ? error.message : String(error) } }),
      prisma.creatorEarning.updateMany({ where: { payoutId: payout.id }, data: { payoutId: null } }),
    ]);
    throw error;
  }
}

export async function requestPayout(userId: string): Promise<{ payoutId: string }> {
  const payout = await claimEarningsForPayout(userId);
  await initiatePayoutTransfer(payout.id); // throws on failure; payout is already FAILED + earnings unclaimed by then
  return { payoutId: payout.id };
}

/** Called from the Paystack transfer.success / Korapay transfer.success webhook. Idempotent. */
export async function handlePayoutCompleted(providerReference: string): Promise<void> {
  const payout = await prisma.payout.findUnique({ where: { providerReference } });
  if (!payout) {
    console.error(`[payouts] transfer success for unknown reference ${providerReference} — ignoring.`);
    return;
  }
  if (payout.status === "PAID") return; // duplicate webhook delivery

  await prisma.$transaction([
    prisma.payout.update({ where: { id: payout.id }, data: { status: "PAID", paidAt: new Date() } }),
    prisma.creatorEarning.updateMany({ where: { payoutId: payout.id }, data: { status: "PAID", paidAt: new Date() } }),
  ]);
}

/** Called from the Paystack transfer.failed / Korapay transfer.failed webhook. Idempotent; releases claimed earnings for retry. */
export async function handlePayoutFailed(providerReference: string, reason?: string): Promise<void> {
  const payout = await prisma.payout.findUnique({ where: { providerReference } });
  if (!payout) {
    console.error(`[payouts] transfer failure for unknown reference ${providerReference} — ignoring.`);
    return;
  }
  if (payout.status === "FAILED") return; // duplicate webhook delivery
  if (payout.status === "PAID") {
    console.error(`[payouts] transfer.failed for already-PAID payout ${payout.id} — ignoring conflicting webhook.`);
    return;
  }

  await prisma.$transaction([
    prisma.payout.update({ where: { id: payout.id }, data: { status: "FAILED", failureReason: reason ?? "Transfer failed" } }),
    prisma.creatorEarning.updateMany({ where: { payoutId: payout.id }, data: { payoutId: null } }),
  ]);
}
