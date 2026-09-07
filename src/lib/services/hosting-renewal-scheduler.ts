import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getHostingProvider } from "@/lib/providers/registry";
import { createOrder, markOrderPaid } from "@/lib/services/orders";
import { notifyUser } from "@/lib/services/notifications";
import { recordAuditLog } from "@/lib/security/audit";
import { logger } from "@/lib/security/logger";

// A subscription stuck PAST_DUE for longer than this is suspended rather
// than retried forever -- mirrors a real host's non-payment grace period.
const PAST_DUE_SUSPEND_AFTER_DAYS = 7;

export interface HostingRenewalSweepResult {
  scanned: number;
  billed: number;
  failed: number;
  suspended: number;
}

/**
 * Runs on a schedule (see hostingRenewalWorker.ts), the hosting counterpart
 * to runDomainRenewalSweep: hosting has no "reminder" concept the way
 * domains do (there's nothing for the customer to opt into -- an ACTIVE
 * subscription just bills every cycle until cancelled), so each due
 * Subscription is charged directly through the normal Order/Payment/Invoice
 * pipeline (createOrder + markOrderPaid), the same machinery any other
 * purchase uses. A subscription that fails and stays PAST_DUE too long gets
 * its HostingAccount suspended instead of being retried forever. Exported
 * standalone so it's callable directly (a test, a manual admin trigger) the
 * same way processDeploymentPipeline and runDomainRenewalSweep are.
 */
export async function runHostingRenewalSweep(now: Date = new Date()): Promise<HostingRenewalSweepResult> {
  const result: HostingRenewalSweepResult = { scanned: 0, billed: 0, failed: 0, suspended: 0 };

  const dueSubscriptions = await prisma.subscription.findMany({
    where: { type: "HOSTING", status: { in: ["ACTIVE", "PAST_DUE"] }, nextBillingDate: { not: null, lte: now } },
  });
  result.scanned = dueSubscriptions.length;

  for (const subscription of dueSubscriptions) {
    if (!subscription.referenceId) continue;
    const account = await prisma.hostingAccount.findUnique({ where: { id: subscription.referenceId }, include: { hostingPlan: true } });
    if (!account) continue;

    if (account.status !== "ACTIVE") {
      // Account was suspended/terminated out of band (e.g. an admin action) --
      // stop billing a subscription for an account that isn't running.
      await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "CANCELLED", cancelledAt: now } });
      continue;
    }

    if (subscription.status === "PAST_DUE" && subscription.nextBillingDate) {
      const overdueDays = (now.getTime() - subscription.nextBillingDate.getTime()) / (1000 * 60 * 60 * 24);
      if (overdueDays > PAST_DUE_SUSPEND_AFTER_DAYS) {
        const provider = await getHostingProvider();
        if (account.providerAccountId) await provider.suspendAccount(account.providerAccountId);
        await prisma.hostingAccount.update({ where: { id: account.id }, data: { status: "SUSPENDED" } });
        await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "EXPIRED" } });
        await recordAuditLog({
          actorId: account.customerId,
          action: "hosting.suspended_for_nonpayment",
          resourceType: "HostingAccount",
          resourceId: account.id,
          newValue: { overdueDays: Math.round(overdueDays) },
        });
        await notifyUser(account.customerId, {
          type: "hosting.suspended",
          title: "Hosting account suspended",
          message: `${account.hostingPlan.name} hosting was suspended after ${Math.round(overdueDays)} days of non-payment. Contact support to reactivate.`,
        });
        result.suspended++;
        continue;
      }
    }

    try {
      const customer = await prisma.user.findUniqueOrThrow({ where: { id: account.customerId } });
      const order = await createOrder(
        account.customerId,
        [
          {
            type: "HOSTING_PLAN",
            hostingPlanId: account.hostingPlanId,
            description: `Hosting renewal — ${account.hostingPlan.name} (monthly)`,
            billingCycle: "MONTHLY",
            quantity: 1,
            unitPrice: Number(subscription.amount),
          },
        ],
        { billingName: customer.name ?? customer.email, billingEmail: customer.email }
      );
      await markOrderPaid(order.id, {
        provider: "mock",
        providerRef: `mock_hosting_renewal_${crypto.randomUUID()}`,
        amount: Number(order.total),
        currency: order.currency,
      });

      const periodStart = subscription.nextBillingDate ?? now;
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "ACTIVE", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, nextBillingDate: periodEnd },
      });

      await recordAuditLog({
        actorId: account.customerId,
        action: "hosting.renewed",
        resourceType: "HostingAccount",
        resourceId: account.id,
        newValue: { orderId: order.id, amount: Number(order.total) },
      });
      await notifyUser(account.customerId, {
        type: "hosting.renewed",
        title: "Hosting renewed",
        message: `Your ${account.hostingPlan.name} hosting was renewed through ${periodEnd.toDateString()}. An invoice is available in your billing history.`,
      });
      result.billed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "PAST_DUE" } });
      await notifyUser(account.customerId, {
        type: "hosting.renewal_failed",
        title: "Hosting renewal failed",
        message: `We couldn't renew your ${account.hostingPlan.name} hosting: ${message}. Please update your billing to avoid suspension.`,
      });
      logger.error("hosting_renewal.failed", { subscriptionId: subscription.id, error: message });
      result.failed++;
    }
  }

  return result;
}
