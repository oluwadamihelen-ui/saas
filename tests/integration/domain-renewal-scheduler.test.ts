import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { runDomainRenewalSweep } from "@/lib/services/domain-renewal-scheduler";

/**
 * DB-backed test for the first repeating/scheduled job in the codebase
 * (see ARCHITECTURE.md Phase 4): runDomainRenewalSweep is the function the
 * BullMQ repeatable worker calls daily, exercised here directly the same
 * way processDeploymentPipeline is in the Phase 3 acceptance test.
 *
 * The sweep runs once in beforeAll (it's a single global scan across every
 * domain, not scoped per test) -- individual `it` blocks only assert on its
 * effects, since calling it again mid-suite would find the auto-renewed /
 * expired domains no longer in its query window and silently no-op on them.
 */
const SUFFIX = `domren-${Date.now()}`;
const NOW = new Date();

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

describe("runDomainRenewalSweep", () => {
  let customerId: string;
  let reminderDomainId: string;
  let autoRenewDomainId: string;
  let expiredDomainId: string;
  let autoRenewOriginalExpiresAt: Date;

  beforeAll(async () => {
    const role = await prisma.role.upsert({ where: { key: "CUSTOMER" }, update: {}, create: { key: "CUSTOMER", name: "Customer" } });
    const customer = await prisma.user.create({
      data: { name: "Renewal Test Customer", email: `${SUFFIX}@example.com`, roleId: role.id, status: "ACTIVE" },
    });
    customerId = customer.id;

    const reminderDomain = await prisma.domain.create({
      data: {
        name: `reminder-${SUFFIX}.com`,
        tld: "com",
        customerId,
        registrarProvider: "mock",
        status: "ACTIVE",
        autoRenew: false,
        expiresAt: daysFromNow(7), // matches the default 7-day threshold exactly
      },
    });
    reminderDomainId = reminderDomain.id;

    const autoRenewDomain = await prisma.domain.create({
      data: {
        name: `autorenew-${SUFFIX}.com`,
        tld: "com",
        customerId,
        registrarProvider: "mock",
        status: "ACTIVE",
        autoRenew: true,
        expiresAt: daysFromNow(2), // inside the 3-day auto-renew trigger window
      },
    });
    autoRenewDomainId = autoRenewDomain.id;
    autoRenewOriginalExpiresAt = autoRenewDomain.expiresAt!;

    const expiredDomain = await prisma.domain.create({
      data: {
        name: `expired-${SUFFIX}.com`,
        tld: "com",
        customerId,
        registrarProvider: "mock",
        status: "ACTIVE",
        autoRenew: false,
        expiresAt: daysFromNow(-2), // already lapsed
      },
    });
    expiredDomainId = expiredDomain.id;

    await runDomainRenewalSweep(NOW);
  });

  afterAll(async () => {
    const domainIds = [reminderDomainId, autoRenewDomainId, expiredDomainId];
    await prisma.renewalEvent.deleteMany({ where: { domainId: { in: domainIds } } });
    await prisma.domainOrder.deleteMany({ where: { domainId: { in: domainIds } } });
    await prisma.notification.deleteMany({ where: { userId: customerId } });
    await prisma.domain.deleteMany({ where: { id: { in: domainIds } } });
    await prisma.auditLog.deleteMany({ where: { actorId: customerId } });
    await prisma.user.delete({ where: { id: customerId } });
  });

  it("sends a reminder (no renewal) for a domain with auto-renew off, within a threshold day", async () => {
    const domain = await prisma.domain.findUniqueOrThrow({ where: { id: reminderDomainId } });
    expect(domain.status).toBe("ACTIVE");
    expect(domain.expiresAt?.toISOString()).toBe(daysFromNow(7).toISOString());

    const renewalEvent = await prisma.renewalEvent.findFirst({ where: { domainId: reminderDomainId } });
    expect(renewalEvent?.status).toBe("UPCOMING");

    const notification = await prisma.notification.findFirst({ where: { userId: customerId, type: "domain.expiry_reminder" } });
    expect(notification).not.toBeNull();
  });

  it("auto-renews a domain with auto-renew on, inside the trigger window", async () => {
    const after = await prisma.domain.findUniqueOrThrow({ where: { id: autoRenewDomainId } });
    expect(after.status).toBe("ACTIVE");
    expect(after.expiresAt!.getTime()).toBeGreaterThan(autoRenewOriginalExpiresAt.getTime());

    const domainOrder = await prisma.domainOrder.findFirst({ where: { domainId: autoRenewDomainId } });
    expect(domainOrder?.action).toBe("RENEW");
    expect(domainOrder?.status).toBe("COMPLETED");

    const renewalEvent = await prisma.renewalEvent.findFirst({ where: { domainId: autoRenewDomainId } });
    expect(renewalEvent?.status).toBe("SUCCEEDED");

    const notification = await prisma.notification.findFirst({ where: { userId: customerId, type: "domain.auto_renewed" } });
    expect(notification).not.toBeNull();
  });

  it("transitions a lapsed domain to EXPIRED and notifies the customer", async () => {
    const domain = await prisma.domain.findUniqueOrThrow({ where: { id: expiredDomainId } });
    expect(domain.status).toBe("EXPIRED");

    const notification = await prisma.notification.findFirst({ where: { userId: customerId, type: "domain.expired" } });
    expect(notification).not.toBeNull();
  });

  it("running the sweep again does not create a duplicate RenewalEvent for the still-upcoming reminder domain", async () => {
    const before = await prisma.renewalEvent.count({ where: { domainId: reminderDomainId } });

    await runDomainRenewalSweep(NOW);
    await runDomainRenewalSweep(NOW);

    const after = await prisma.renewalEvent.count({ where: { domainId: reminderDomainId } });
    expect(after).toBe(before);
    expect(after).toBe(1);
  });
}, 30000);
