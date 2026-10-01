import "server-only";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { PRICING } from "@/config/plans";
import { getPaymentProvider } from "@/lib/payments";
import { activateFromPayment } from "@/lib/billing";

const DAY = 86_400_000;
export const RENEW_AHEAD_MS = DAY; // try to charge when ≤ 1 day remains
export const RETRY_EVERY_MS = 12 * 3_600_000;
export const GRACE_MS = 3 * DAY; // keep retrying for 3 days after expiry

export interface RenewalCandidate {
  status: string;
  autoRenew: boolean;
  authorizationCode: string | null;
  currentPeriodEnd: Date;
  lastRenewalAttemptAt: Date | null;
}

/** Pure rule: should we attempt to charge this subscription now? */
export function isRenewalDue(s: RenewalCandidate, now: Date): boolean {
  if (s.status !== "ACTIVE" || !s.autoRenew || !s.authorizationCode) return false;
  const end = s.currentPeriodEnd.getTime();
  if (now.getTime() < end - RENEW_AHEAD_MS) return false; // too early
  if (now.getTime() > end + GRACE_MS) return false; // gave up
  if (s.lastRenewalAttemptAt && now.getTime() - s.lastRenewalAttemptAt.getTime() < RETRY_EVERY_MS) return false;
  return true;
}

export interface RenewalReport {
  attempted: number;
  renewed: number;
  failed: number;
  expired: number;
}

export async function renewDueSubscriptions(now = new Date(), onFailure?: (userId: string) => Promise<void>): Promise<RenewalReport> {
  const provider = getPaymentProvider();
  const report: RenewalReport = { attempted: 0, renewed: 0, failed: 0, expired: 0 };
  if (!provider.chargeRecurring) return report;

  const candidates = await prisma.subscription.findMany({
    where: { provider: provider.name, status: "ACTIVE", autoRenew: true, authorizationCode: { not: null }, currentPeriodEnd: { lte: new Date(now.getTime() + RENEW_AHEAD_MS), gte: new Date(now.getTime() - GRACE_MS) } },
    include: { user: { select: { id: true, email: true } } },
  });

  for (const sub of candidates) {
    if (!isRenewalDue(sub, now)) continue;
    // Claim the attempt first so overlapping cron runs can't double-charge.
    const claim = await prisma.subscription.updateMany({
      where: { id: sub.id, OR: [{ lastRenewalAttemptAt: null }, { lastRenewalAttemptAt: { lt: new Date(now.getTime() - RETRY_EVERY_MS) } }] },
      data: { lastRenewalAttemptAt: now },
    });
    if (claim.count === 0) continue;
    report.attempted++;

    const last = await prisma.payment.findFirst({ where: { subscriptionId: sub.id, status: "SUCCEEDED" }, orderBy: { createdAt: "desc" } });
    const currency = last?.currency ?? "USD";
    const amount = currency === "NGN" ? PRICING[sub.interval].ngn : PRICING[sub.interval].usd;
    const reference = `rp_r_${randomUUID().replace(/-/g, "")}`;
    const payment = await prisma.payment.create({
      data: { userId: sub.userId, subscriptionId: sub.id, provider: provider.name, reference, amount, currency, interval: sub.interval, status: "PENDING", renewal: true },
    });

    let ok = false;
    try {
      const r = await provider.chargeRecurring({ reference, amount, currency, email: sub.user.email, authorizationCode: sub.authorizationCode! });
      ok = r.status === "SUCCEEDED" && (r.amount === undefined || r.amount === amount);
      // PENDING is resolved later by the webhook (charge.success); leave the payment pending.
      if (r.status === "PENDING") continue;
    } catch {
      ok = false;
    }
    if (ok) {
      await activateFromPayment(payment.id);
      report.renewed++;
    } else {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      report.failed++;
      await onFailure?.(sub.userId);
    }
  }

  // Housekeeping: anything past its end date plus grace is expired.
  const exp = await prisma.subscription.updateMany({ where: { status: "ACTIVE", currentPeriodEnd: { lt: new Date(now.getTime() - GRACE_MS) } }, data: { status: "EXPIRED" } });
  report.expired = exp.count;
  return report;
}
