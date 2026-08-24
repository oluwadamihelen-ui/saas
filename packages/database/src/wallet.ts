import type { Prisma, PrismaClient, WalletTransactionType } from "@prisma/client";
import { prisma } from "./index.js";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Every user gets a Coin wallet lazily, on first need — not at signup,
 * since most users never buy or earn coins.
 */
export async function getOrCreateWallet(userId: string, client: Tx = prisma) {
  const existing = await client.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return client.wallet.create({ data: { userId, balance: 0 } });
}

export async function getWalletBalance(userId: string): Promise<number> {
  const wallet = await prisma.wallet.findUnique({ where: { userId }, select: { balance: true } });
  return wallet?.balance ?? 0;
}

export interface RecordWalletTransactionParams {
  userId: string;
  type: WalletTransactionType;
  amount: number; // signed
  referenceType?: string;
  referenceId?: string;
  reversesId?: string;
  idempotencyKey?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * The single write path for every wallet balance change: locks in a new
 * ledger row and updates the cached Wallet.balance in the same call, so
 * the two never drift. Must always run inside an active `tx` — the caller
 * owns the surrounding $transaction (and, for anything that must not
 * double-fire under concurrency, the idempotencyKey that makes the
 * underlying WalletTransaction insert fail loudly on a duplicate rather
 * than silently succeeding twice).
 *
 * Lives in packages/database (not apps/web) so both the web app and the
 * worker's background jobs — e.g. promotional-coin expiration — write
 * through the exact same code, never a duplicated copy that could drift.
 */
export async function recordWalletTransaction(tx: Prisma.TransactionClient, params: RecordWalletTransactionParams) {
  const wallet = await getOrCreateWallet(params.userId, tx);
  const newBalance = wallet.balance + params.amount;

  const transaction = await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      userId: params.userId,
      type: params.type,
      amount: params.amount,
      balanceAfter: newBalance,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      reversesId: params.reversesId,
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata,
    },
  });

  await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });

  return { transaction, balanceAfter: newBalance };
}

/**
 * The platform's own ledger account, for true double-entry symmetry: every
 * settled unlock debits the viewer's wallet and credits both the
 * publisher's wallet and this one, so the three always sum to zero — no
 * "platform revenue" figure that only exists as an unverified derived
 * number. Not a real login-capable account; seeded once (prisma/seed.ts)
 * and looked up here, with a create-on-missing fallback so a fresh
 * database that skipped seeding doesn't hard-crash the first unlock.
 */
export const PLATFORM_SYSTEM_EMAIL = "platform@cinerra.internal";

export async function getPlatformUserId(client: Tx = prisma): Promise<string> {
  const existing = await client.user.findUnique({ where: { email: PLATFORM_SYSTEM_EMAIL }, select: { id: true } });
  if (existing) return existing.id;
  const created = await client.user.create({ data: { email: PLATFORM_SYSTEM_EMAIL, name: "Cinerra Platform", status: "ACTIVE" } });
  return created.id;
}

/** True when a Prisma error is a unique-constraint violation on the given field (used to detect a lost idempotency race, not a real failure). */
export function isUniqueConstraintViolation(error: unknown, field: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002" &&
    "meta" in error &&
    Boolean((error as { meta?: { target?: string[] } }).meta?.target?.includes(field))
  );
}
