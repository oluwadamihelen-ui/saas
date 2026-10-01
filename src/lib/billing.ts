import "server-only";
import { prisma } from "@/lib/db";
import { PRICING } from "@/config/plans";

/** Idempotently marks a payment successful and extends the user's Pro subscription. */
export async function activateFromPayment(paymentId: string) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!p || p.status === "SUCCEEDED") return p;
    const now = new Date();
    const active = await tx.subscription.findFirst({ where: { userId: p.userId, status: "ACTIVE", currentPeriodEnd: { gt: now } }, orderBy: { currentPeriodEnd: "desc" } });
    const start = active ? active.currentPeriodEnd : now;
    const end = new Date(start.getTime() + PRICING[p.interval].days * 86_400_000);
    const sub = active
      ? await tx.subscription.update({ where: { id: active.id }, data: { currentPeriodEnd: end, interval: p.interval } })
      : await tx.subscription.create({ data: { userId: p.userId, plan: "PRO", interval: p.interval, provider: p.provider, providerRef: p.reference, currentPeriodEnd: end } });
    return tx.payment.update({ where: { id: p.id }, data: { status: "SUCCEEDED", subscriptionId: sub.id } });
  });
}
