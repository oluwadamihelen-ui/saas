import { prisma } from "@/lib/db";
import { getDomainProvider } from "@/lib/providers/registry";
import { notifyUser } from "@/lib/services/notifications";
import { recordAuditLog } from "@/lib/security/audit";
import { logger } from "@/lib/security/logger";

const DEFAULT_DAYS_BEFORE = [30, 14, 7, 3, 1];
// Auto-renew fires once a domain gets this close to expiry -- late enough
// that we're confident it's really about to lapse, early enough to still
// leave room to notify the customer if the registrar call fails.
const AUTO_RENEW_TRIGGER_DAYS = 3;
const RENEWAL_YEARS = 1;

function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export interface DomainRenewalSweepResult {
  scanned: number;
  autoRenewed: number;
  remindersSent: number;
  failed: number;
  expired: number;
}

/**
 * Runs on a schedule (see domainRenewalWorker.ts) to keep domain expiry
 * handled without a human watching a calendar: reminds customers whose
 * domain is approaching expiry, auto-renews domains that opted in once
 * they're close enough to expiry to act, and flips domains that lapsed
 * without renewal to EXPIRED. Exported standalone (not just wired to the
 * queue) so it can be invoked directly -- a manual admin trigger, or a test --
 * the same way processDeploymentPipeline is.
 */
export async function runDomainRenewalSweep(now: Date = new Date()): Promise<DomainRenewalSweepResult> {
  const schedule = await prisma.notificationSchedule.findUnique({ where: { key: "domain.expiry" } });
  const daysBefore = schedule && !schedule.isActive ? [] : schedule?.daysBefore?.length ? schedule.daysBefore : DEFAULT_DAYS_BEFORE;

  const result: DomainRenewalSweepResult = { scanned: 0, autoRenewed: 0, remindersSent: 0, failed: 0, expired: 0 };
  const maxWindow = daysBefore.length ? Math.max(...daysBefore, AUTO_RENEW_TRIGGER_DAYS) : 0;
  if (maxWindow <= 0) return result;

  const windowEnd = new Date(now.getTime() + maxWindow * 24 * 60 * 60 * 1000);
  const domains = await prisma.domain.findMany({
    where: { status: "ACTIVE", expiresAt: { not: null, lte: windowEnd } },
  });
  result.scanned = domains.length;

  const domainProvider = await getDomainProvider();

  for (const domain of domains) {
    if (!domain.expiresAt) continue;
    const remaining = daysUntil(domain.expiresAt, now);

    if (remaining < 0) {
      await prisma.domain.update({ where: { id: domain.id }, data: { status: "EXPIRED" } });
      await recordAuditLog({
        actorId: domain.customerId,
        action: "domain.expired",
        resourceType: "Domain",
        resourceId: domain.id,
        oldValue: { expiresAt: domain.expiresAt.toISOString() },
      });
      await notifyUser(domain.customerId, { type: "domain.expired", title: "Domain expired", message: `${domain.name} has expired and is no longer active.` });
      result.expired++;
      continue;
    }

    let renewalEvent = await prisma.renewalEvent.findFirst({
      where: { referenceType: "DOMAIN", domainId: domain.id, status: { in: ["UPCOMING", "FAILED"] } },
      orderBy: { createdAt: "desc" },
    });

    const quote = await domainProvider.getPricingQuote(domain.name, RENEWAL_YEARS, "renew");

    if (!renewalEvent) {
      renewalEvent = await prisma.renewalEvent.create({
        data: { referenceType: "DOMAIN", domainId: domain.id, status: "UPCOMING", dueDate: domain.expiresAt, amount: quote.price, currency: quote.currency },
      });
    }

    const shouldAutoRenew = domain.autoRenew && remaining <= AUTO_RENEW_TRIGGER_DAYS;
    const shouldRemind = !domain.autoRenew && daysBefore.includes(remaining);

    if (shouldAutoRenew) {
      try {
        const { expiresAt } = await domainProvider.renewDomain(domain.name, RENEWAL_YEARS, domain.expiresAt.toISOString());
        await prisma.domain.update({ where: { id: domain.id }, data: { expiresAt: new Date(expiresAt) } });
        await prisma.domainOrder.create({
          data: {
            domainId: domain.id,
            domainName: domain.name,
            action: "RENEW",
            years: RENEWAL_YEARS,
            providerCost: quote.price,
            customerPrice: quote.price,
            status: "COMPLETED",
          },
        });
        await prisma.renewalEvent.update({ where: { id: renewalEvent.id }, data: { status: "SUCCEEDED", processedAt: new Date() } });
        await recordAuditLog({ actorId: domain.customerId, action: "domain.auto_renewed", resourceType: "Domain", resourceId: domain.id, newValue: { expiresAt } });
        await notifyUser(domain.customerId, {
          type: "domain.auto_renewed",
          title: "Domain auto-renewed",
          message: `${domain.name} was automatically renewed through ${new Date(expiresAt).toDateString()}.`,
        });
        result.autoRenewed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        await prisma.renewalEvent.update({ where: { id: renewalEvent.id }, data: { status: "FAILED", failureReason: message } });
        await notifyUser(domain.customerId, {
          type: "domain.auto_renew_failed",
          title: "Domain auto-renewal failed",
          message: `We couldn't auto-renew ${domain.name}: ${message}. Please renew it manually.`,
        });
        logger.error("domain_renewal.auto_renew_failed", { domainId: domain.id, error: message });
        result.failed++;
      }
    } else if (shouldRemind) {
      await notifyUser(domain.customerId, {
        type: "domain.expiry_reminder",
        title: "Domain renewal reminder",
        message: `${domain.name} expires in ${remaining} day${remaining === 1 ? "" : "s"}. Renew now to avoid losing it.`,
      });
      result.remindersSent++;
    }
  }

  return result;
}
