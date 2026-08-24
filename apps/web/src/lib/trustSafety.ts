import { prisma } from "./db";

export class UserNotFoundError extends Error {
  constructor() {
    super("We couldn't find a user with that email.");
  }
}

export class CannotSuspendSelfError extends Error {
  constructor() {
    super("You can't suspend your own account.");
  }
}

export interface RefundRiskUser {
  userId: string;
  email: string;
  name: string | null;
  accountStatus: string;
  totalPurchases: number;
  refundedPurchases: number;
  refundRate: number; // 0..1
}

export interface VelocityRiskUser {
  userId: string;
  email: string;
  name: string | null;
  accountStatus: string;
  purchaseCount: number;
  windowHours: number;
}

export interface FraudSignals {
  refundRisk: RefundRiskUser[];
  velocityRisk: VelocityRiskUser[];
}

// A refund isn't itself proof of abuse (a legitimate one-off refund is
// normal), so this only flags accounts with enough purchase volume for a
// rate to mean something, and only once that rate is high enough to look
// like a pattern rather than a single unlucky purchase.
const MIN_PURCHASES_FOR_REFUND_SIGNAL = 3;
const REFUND_RATE_THRESHOLD = 0.5;

const VELOCITY_WINDOW_HOURS = 24;
const VELOCITY_THRESHOLD = 5;

/**
 * Real signals computed from CoinPurchase, not a fabricated fraud score —
 * there's no ML model or device/IP data behind this. Two honest heuristics:
 * a high refund rate (spend coins, refund the purchase, keep the content)
 * and unusually fast repeat purchasing. Both are for a human admin to
 * review, not to act on automatically — self-purchase (a creator watching
 * their own paid content) is explicitly NOT flagged here, since no money
 * moves and there's nothing to detect.
 */
export async function getFraudSignals(): Promise<FraudSignals> {
  const [refundGrouped, velocityGrouped] = await Promise.all([
    prisma.coinPurchase.groupBy({
      by: ["userId", "status"],
      _count: true,
      where: { status: { in: ["COMPLETED", "REFUNDED"] } },
    }),
    prisma.coinPurchase.groupBy({
      by: ["userId"],
      _count: true,
      where: { createdAt: { gte: new Date(Date.now() - VELOCITY_WINDOW_HOURS * 60 * 60 * 1000) } },
    }),
  ]);

  const refundTotals = new Map<string, { total: number; refunded: number }>();
  for (const row of refundGrouped) {
    const entry = refundTotals.get(row.userId) ?? { total: 0, refunded: 0 };
    entry.total += row._count;
    if (row.status === "REFUNDED") entry.refunded += row._count;
    refundTotals.set(row.userId, entry);
  }

  const flaggedRefundIds = [...refundTotals.entries()].filter(
    ([, v]) => v.total >= MIN_PURCHASES_FOR_REFUND_SIGNAL && v.refunded / v.total >= REFUND_RATE_THRESHOLD,
  );
  const flaggedVelocityRows = velocityGrouped.filter((r) => r._count >= VELOCITY_THRESHOLD);

  const allFlaggedIds = [...new Set([...flaggedRefundIds.map(([id]) => id), ...flaggedVelocityRows.map((r) => r.userId)])];
  const users = await prisma.user.findMany({ where: { id: { in: allFlaggedIds } }, select: { id: true, email: true, name: true, status: true } });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const refundRisk: RefundRiskUser[] = flaggedRefundIds
    .map(([userId, v]) => {
      const u = userMap.get(userId);
      return {
        userId,
        email: u?.email ?? "unknown",
        name: u?.name ?? null,
        accountStatus: u?.status ?? "ACTIVE",
        totalPurchases: v.total,
        refundedPurchases: v.refunded,
        refundRate: v.refunded / v.total,
      };
    })
    .sort((a, b) => b.refundRate - a.refundRate);

  const velocityRisk: VelocityRiskUser[] = flaggedVelocityRows
    .map((r) => {
      const u = userMap.get(r.userId);
      return {
        userId: r.userId,
        email: u?.email ?? "unknown",
        name: u?.name ?? null,
        accountStatus: u?.status ?? "ACTIVE",
        purchaseCount: r._count,
        windowHours: VELOCITY_WINDOW_HOURS,
      };
    })
    .sort((a, b) => b.purchaseCount - a.purchaseCount);

  return { refundRisk, velocityRisk };
}

export async function suspendUser(params: { targetUserEmail: string; adminUserId: string; reason?: string }): Promise<void> {
  const targetUser = await prisma.user.findUnique({ where: { email: params.targetUserEmail.toLowerCase() }, select: { id: true } });
  if (!targetUser) throw new UserNotFoundError();
  if (targetUser.id === params.adminUserId) throw new CannotSuspendSelfError();

  await prisma.$transaction([
    prisma.user.update({ where: { id: targetUser.id }, data: { status: "SUSPENDED" } }),
    prisma.auditLog.create({
      data: {
        userId: params.adminUserId,
        action: "USER_SUSPENDED",
        entityType: "User",
        entityId: targetUser.id,
        metadata: { targetEmail: params.targetUserEmail.toLowerCase(), reason: params.reason ?? null },
      },
    }),
  ]);
}

export async function unsuspendUser(params: { targetUserEmail: string; adminUserId: string }): Promise<void> {
  const targetUser = await prisma.user.findUnique({ where: { email: params.targetUserEmail.toLowerCase() }, select: { id: true } });
  if (!targetUser) throw new UserNotFoundError();

  await prisma.$transaction([
    prisma.user.update({ where: { id: targetUser.id }, data: { status: "ACTIVE" } }),
    prisma.auditLog.create({
      data: {
        userId: params.adminUserId,
        action: "USER_UNSUSPENDED",
        entityType: "User",
        entityId: targetUser.id,
        metadata: { targetEmail: params.targetUserEmail.toLowerCase() },
      },
    }),
  ]);
}
