import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { runHostingRenewalSweep } from "@/lib/services/hosting-renewal-scheduler";

/**
 * DB-backed test for the second repeating job in the codebase (the hosting
 * counterpart to runDomainRenewalSweep, see ARCHITECTURE.md Phase 5):
 * exercised directly the same way processDeploymentPipeline and
 * runDomainRenewalSweep are, rather than only through the BullMQ worker.
 */
const SUFFIX = `hostren-${Date.now()}`;
const NOW = new Date();

describe("runHostingRenewalSweep", () => {
  let customerId: string;
  let planId: string;
  let dueAccountId: string;
  let dueSubscriptionId: string;
  let overdueAccountId: string;
  let overdueSubscriptionId: string;
  let originalNextBilling: Date;

  beforeAll(async () => {
    const role = await prisma.role.upsert({ where: { key: "CUSTOMER" }, update: {}, create: { key: "CUSTOMER", name: "Customer" } });
    const customer = await prisma.user.create({
      data: { name: "Hosting Renewal Test Customer", email: `${SUFFIX}@example.com`, roleId: role.id, status: "ACTIVE" },
    });
    customerId = customer.id;

    const plan = await prisma.hostingPlan.upsert({
      where: { slug: `test-plan-${SUFFIX}` },
      update: {},
      create: { name: `Test Plan ${SUFFIX}`, slug: `test-plan-${SUFFIX}`, priceMonthly: 20, sortOrder: 0 },
    });
    planId = plan.id;

    const dueAccount = await prisma.hostingAccount.create({
      data: { customerId, hostingPlanId: planId, provider: "mock", providerAccountId: `mock_${SUFFIX}_due`, status: "ACTIVE" },
    });
    dueAccountId = dueAccount.id;
    originalNextBilling = new Date(NOW.getTime() - 60 * 60 * 1000); // 1 hour ago
    const dueSubscription = await prisma.subscription.create({
      data: {
        customerId,
        type: "HOSTING",
        referenceId: dueAccountId,
        status: "ACTIVE",
        amount: 20,
        billingCycle: "MONTHLY",
        currentPeriodStart: new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: originalNextBilling,
        nextBillingDate: originalNextBilling,
      },
    });
    dueSubscriptionId = dueSubscription.id;

    const overdueAccount = await prisma.hostingAccount.create({
      data: { customerId, hostingPlanId: planId, provider: "mock", providerAccountId: `mock_${SUFFIX}_overdue`, status: "ACTIVE" },
    });
    overdueAccountId = overdueAccount.id;
    const overdueNextBilling = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const overdueSubscription = await prisma.subscription.create({
      data: {
        customerId,
        type: "HOSTING",
        referenceId: overdueAccountId,
        status: "PAST_DUE",
        amount: 20,
        billingCycle: "MONTHLY",
        currentPeriodStart: new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: overdueNextBilling,
        nextBillingDate: overdueNextBilling,
      },
    });
    overdueSubscriptionId = overdueSubscription.id;

    await runHostingRenewalSweep(NOW);
  });

  afterAll(async () => {
    // Guard against beforeAll having thrown before these ids were assigned --
    // an unscoped `where: { customerId: undefined }` matches every row in the
    // table, so without this a setup failure would wipe unrelated data.
    if (!customerId || !planId || !dueAccountId || !overdueAccountId) return;

    const accountIds = [dueAccountId, overdueAccountId];
    await prisma.deploymentTarget.deleteMany({ where: { hostingAccountId: { in: accountIds } } });
    await prisma.subscription.deleteMany({ where: { referenceId: { in: accountIds } } });
    await prisma.hostingAccount.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.hostingPlan.delete({ where: { id: planId } });

    const orders = await prisma.order.findMany({ where: { customerId }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    await prisma.invoiceItem.deleteMany({ where: { invoice: { orderId: { in: orderIds } } } });
    await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });

    await prisma.notification.deleteMany({ where: { userId: customerId } });
    await prisma.auditLog.deleteMany({ where: { actorId: customerId } });
    await prisma.user.delete({ where: { id: customerId } });
  });

  it("bills a due ACTIVE subscription and rolls the billing period forward", async () => {
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { id: dueSubscriptionId } });
    expect(subscription.status).toBe("ACTIVE");
    expect(subscription.nextBillingDate!.getTime()).toBeGreaterThan(originalNextBilling.getTime());

    const order = await prisma.order.findFirst({ where: { customerId }, orderBy: { createdAt: "desc" } });
    expect(order?.paymentStatus).toBe("PAID");

    const invoice = order ? await prisma.invoice.findUnique({ where: { orderId: order.id } }) : null;
    expect(invoice).not.toBeNull();

    const notification = await prisma.notification.findFirst({ where: { userId: customerId, type: "hosting.renewed" } });
    expect(notification).not.toBeNull();
  });

  it("suspends a HostingAccount whose subscription has been PAST_DUE too long", async () => {
    const account = await prisma.hostingAccount.findUniqueOrThrow({ where: { id: overdueAccountId } });
    expect(account.status).toBe("SUSPENDED");

    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { id: overdueSubscriptionId } });
    expect(subscription.status).toBe("EXPIRED");

    const notification = await prisma.notification.findFirst({ where: { userId: customerId, type: "hosting.suspended" } });
    expect(notification).not.toBeNull();
  });
}, 30000);
