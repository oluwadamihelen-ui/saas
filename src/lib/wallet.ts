import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { TenantError } from "@/lib/errors";

/**
 * A business is in "wallet mode" — its sale proceeds land in MAMA's pooled
 * platform Paystack account and are tracked here — whenever it hasn't
 * connected its own Paystack account. A business with its own connected
 * account is paid directly by Paystack and never touches the wallet.
 */
export async function isWalletModeBusiness(businessId: string): Promise<boolean> {
  const settings = await prisma.paymentSettings.findUnique({ where: { businessId } });
  return !settings?.isConnected;
}

export async function getOrCreateWallet(businessId: string) {
  return prisma.wallet.upsert({
    where: { businessId },
    create: { businessId },
    update: {},
  });
}

/**
 * Credits a wallet and writes the matching ledger row atomically. Always
 * safe to call concurrently — the increment happens in the same DB
 * transaction as the ledger insert.
 */
export async function creditWallet(
  businessId: string,
  amount: Prisma.Decimal | number,
  type: "SALE_CREDIT" | "WITHDRAWAL_REVERSAL" | "WALLET_PURCHASE_CREDIT" | "ADJUSTMENT",
  opts: { orderId?: string; payoutId?: string; counterpartyBusinessId?: string; description?: string } = {}
) {
  const amt = new Prisma.Decimal(amount);
  if (amt.lte(0)) throw new TenantError("Credit amount must be positive", 400);

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({ where: { businessId }, create: { businessId }, update: {} });
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amt } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type,
        amount: amt,
        balanceAfter: updated.balance,
        orderId: opts.orderId,
        payoutId: opts.payoutId,
        counterpartyBusinessId: opts.counterpartyBusinessId,
        description: opts.description,
      },
    });
    return updated;
  });
}

/**
 * Debits a wallet only if it has sufficient balance — enforced with a
 * conditional `updateMany` (balance >= amount) rather than a
 * read-then-write, so two concurrent debits can never both succeed against
 * a balance that only covers one of them.
 */
export async function debitWallet(
  businessId: string,
  amount: Prisma.Decimal | number,
  type: "WITHDRAWAL" | "WALLET_PURCHASE_DEBIT" | "ADJUSTMENT",
  opts: { orderId?: string; payoutId?: string; counterpartyBusinessId?: string; description?: string } = {}
) {
  const amt = new Prisma.Decimal(amount);
  if (amt.lte(0)) throw new TenantError("Debit amount must be positive", 400);

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({ where: { businessId }, create: { businessId }, update: {} });

    const result = await tx.wallet.updateMany({
      where: { id: wallet.id, balance: { gte: amt } },
      data: { balance: { decrement: amt } },
    });
    if (result.count === 0) {
      throw new TenantError("Insufficient wallet balance", 402);
    }

    const updated = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type,
        amount: amt,
        balanceAfter: updated.balance,
        orderId: opts.orderId,
        payoutId: opts.payoutId,
        counterpartyBusinessId: opts.counterpartyBusinessId,
        description: opts.description,
      },
    });
    return updated;
  });
}

/**
 * Moves balance from one business's wallet straight to another's — used
 * when a merchant checks out of another merchant's store using their MAMA
 * wallet balance instead of a real payment. No money actually moves
 * anywhere; it's the same pooled platform account the whole time, just
 * re-attributed between the two ledgers in one DB transaction.
 */
export async function transferBetweenWallets(
  fromBusinessId: string,
  toBusinessId: string,
  amount: Prisma.Decimal | number,
  orderId: string
) {
  const amt = new Prisma.Decimal(amount);
  if (amt.lte(0)) throw new TenantError("Transfer amount must be positive", 400);
  if (fromBusinessId === toBusinessId) throw new TenantError("Cannot pay yourself from your own wallet", 400);

  return prisma.$transaction(async (tx) => {
    const fromWallet = await tx.wallet.upsert({ where: { businessId: fromBusinessId }, create: { businessId: fromBusinessId }, update: {} });

    const debited = await tx.wallet.updateMany({
      where: { id: fromWallet.id, balance: { gte: amt } },
      data: { balance: { decrement: amt } },
    });
    if (debited.count === 0) throw new TenantError("Insufficient wallet balance", 402);

    const fromUpdated = await tx.wallet.findUniqueOrThrow({ where: { id: fromWallet.id } });
    await tx.walletTransaction.create({
      data: {
        walletId: fromWallet.id,
        type: "WALLET_PURCHASE_DEBIT",
        amount: amt,
        balanceAfter: fromUpdated.balance,
        orderId,
        counterpartyBusinessId: toBusinessId,
        description: "Purchase from another MAMA merchant",
      },
    });

    const toWallet = await tx.wallet.upsert({ where: { businessId: toBusinessId }, create: { businessId: toBusinessId }, update: {} });
    const toUpdated = await tx.wallet.update({ where: { id: toWallet.id }, data: { balance: { increment: amt } } });
    await tx.walletTransaction.create({
      data: {
        walletId: toWallet.id,
        type: "WALLET_PURCHASE_CREDIT",
        amount: amt,
        balanceAfter: toUpdated.balance,
        orderId,
        counterpartyBusinessId: fromBusinessId,
        description: "Sale paid via buyer's MAMA wallet",
      },
    });

    return { from: fromUpdated, to: toUpdated };
  });
}
