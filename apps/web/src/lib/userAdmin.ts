import { prisma } from "./db";
import { recordWalletTransaction } from "@cinerra/database";
import { UserNotFoundError } from "./trustSafety";

export { UserNotFoundError };

export class CannotRemoveOwnAdminRoleError extends Error {
  constructor() {
    super("You can't remove your own admin role.");
  }
}

export class InvalidBalanceAdjustmentError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class EmailAlreadyInUseError extends Error {
  constructor() {
    super("That email is already in use by another account.");
  }
}

export interface UserAdminRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: Date;
  walletBalance: number;
}

const LIST_LIMIT = 200;

/**
 * Recent users for the admin Users tab, optionally filtered by a
 * case-insensitive email/name search. Capped at LIST_LIMIT — an honest
 * "most recent N" list, not a claim of showing every user, since the
 * table renders and filters this client-side.
 */
export async function listUsers(search?: string): Promise<UserAdminRow[]> {
  const users = await prisma.user.findMany({
    where: search
      ? { OR: [{ email: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    include: { wallet: { select: { balance: true } } },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    walletBalance: u.wallet?.balance ?? 0,
  }));
}

/**
 * A direct, immediate ledger adjustment to a user's coin balance — for
 * support/goodwill credits or correcting a mistake, distinct from
 * promotional grants (which expire and have their own FIFO-consumption
 * rules). Positive amount credits, negative debits; a debit that would
 * take the balance below zero is rejected rather than silently clamped.
 */
export async function adjustUserBalance(params: {
  targetUserId: string;
  adminUserId: string;
  amount: number;
  reason?: string;
}): Promise<{ balanceAfter: number }> {
  if (!Number.isInteger(params.amount) || params.amount === 0) {
    throw new InvalidBalanceAdjustmentError("Enter a non-zero whole number of coins.");
  }

  const targetUser = await prisma.user.findUnique({ where: { id: params.targetUserId }, select: { id: true } });
  if (!targetUser) throw new UserNotFoundError();

  return prisma.$transaction(async (tx) => {
    if (params.amount < 0) {
      const wallet = await tx.wallet.findUnique({ where: { userId: params.targetUserId }, select: { balance: true } });
      if ((wallet?.balance ?? 0) + params.amount < 0) {
        throw new InvalidBalanceAdjustmentError("That would take the balance below zero.");
      }
    }

    const { balanceAfter } = await recordWalletTransaction(tx, {
      userId: params.targetUserId,
      type: "ADJUSTMENT",
      amount: params.amount,
      referenceType: "AdminAdjustment",
      metadata: { adminUserId: params.adminUserId, reason: params.reason ?? null },
    });

    await tx.auditLog.create({
      data: {
        userId: params.adminUserId,
        action: "USER_BALANCE_ADJUSTED",
        entityType: "User",
        entityId: params.targetUserId,
        metadata: { amount: params.amount, balanceAfter, reason: params.reason ?? null },
      },
    });

    return { balanceAfter };
  });
}

/** Admin edit of a user's own profile fields — name, email, and (with a self-demotion guard) role. */
export async function updateUserProfile(params: {
  targetUserId: string;
  adminUserId: string;
  name?: string;
  email?: string;
  role?: "USER" | "ADMIN";
}): Promise<void> {
  const targetUser = await prisma.user.findUnique({ where: { id: params.targetUserId }, select: { id: true, role: true } });
  if (!targetUser) throw new UserNotFoundError();

  if (params.role && params.role !== targetUser.role && targetUser.id === params.adminUserId && params.role !== "ADMIN") {
    throw new CannotRemoveOwnAdminRoleError();
  }

  const data: { name?: string; email?: string; role?: "USER" | "ADMIN" } = {};
  if (params.name !== undefined) data.name = params.name;
  if (params.email !== undefined) data.email = params.email.toLowerCase();
  if (params.role !== undefined) data.role = params.role;

  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: params.targetUserId }, data }),
      prisma.auditLog.create({
        data: {
          userId: params.adminUserId,
          action: "USER_PROFILE_EDITED",
          entityType: "User",
          entityId: params.targetUserId,
          metadata: data,
        },
      }),
    ]);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
      throw new EmailAlreadyInUseError();
    }
    throw error;
  }
}
