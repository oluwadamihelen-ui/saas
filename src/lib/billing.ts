import "server-only";
import { prisma } from "@/lib/db";
import { PRICING } from "@/config/plans";

/**
 * Marks a payment successful and extends the Pro subscription — exactly once.
 * The status flip is an atomic claim (`updateMany ... status != SUCCEEDED`), so two
 * concurrent webhook deliveries / callbacks can never extend the period twice.
 */
export async function activateFromPayment(paymentId: string, opts: { authorizationCode?: string } = {}) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const claim = await tx.payment.updateMany({ where: { id: paymentId, status: { not: "SUCCEEDED" } }, data: { status: "SUCCEEDED", paidAt: now } });
    const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (claim.count === 0) return p; // already processed

    let target = p.subscriptionId ? await tx.subscription.findUnique({ where: { id: p.subscriptionId } }) : null;
    target ??= await tx.subscription.findFirst({ where: { userId: p.userId, status: "ACTIVE", currentPeriodEnd: { gt: now } }, orderBy: { currentPeriodEnd: "desc" } });

    const start = target && target.currentPeriodEnd > now ? target.currentPeriodEnd : now;
    const end = new Date(start.getTime() + PRICING[p.interval].days * 86_400_000);
    const sub = target
      ? await tx.subscription.update({
          where: { id: target.id },
          data: { currentPeriodEnd: end, interval: p.interval, status: "ACTIVE", canceledAt: null, ...(opts.authorizationCode ? { authorizationCode: opts.authorizationCode } : {}) },
        })
      : await tx.subscription.create({
          data: { userId: p.userId, plan: "PRO", interval: p.interval, provider: p.provider, providerRef: p.reference, currentPeriodEnd: end, authorizationCode: opts.authorizationCode ?? null },
        });
    return tx.payment.update({ where: { id: p.id }, data: { subscriptionId: sub.id } });
  });
}
