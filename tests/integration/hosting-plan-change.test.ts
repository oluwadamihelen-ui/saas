import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { changeHostingPlan, suspendHostingAccount, unsuspendHostingAccount, terminateHostingAccount } from "@/lib/services/hosting-accounts";

const SUFFIX = `hostplan-${Date.now()}`;

describe("hosting account lifecycle service", () => {
  let customerId: string;
  let starterPlanId: string;
  let businessPlanId: string;
  let accountId: string;
  let subscriptionId: string;

  beforeAll(async () => {
    const role = await prisma.role.upsert({ where: { key: "CUSTOMER" }, update: {}, create: { key: "CUSTOMER", name: "Customer" } });
    const customer = await prisma.user.create({
      data: { name: "Hosting Lifecycle Test Customer", email: `${SUFFIX}@example.com`, roleId: role.id, status: "ACTIVE" },
    });
    customerId = customer.id;

    const starter = await prisma.hostingPlan.upsert({
      where: { slug: `test-starter-${SUFFIX}` },
      update: {},
      create: { name: `Test Starter ${SUFFIX}`, slug: `test-starter-${SUFFIX}`, priceMonthly: 12, sortOrder: 0 },
    });
    starterPlanId = starter.id;

    const business = await prisma.hostingPlan.upsert({
      where: { slug: `test-business-${SUFFIX}` },
      update: {},
      create: { name: `Test Business ${SUFFIX}`, slug: `test-business-${SUFFIX}`, priceMonthly: 35, sortOrder: 1 },
    });
    businessPlanId = business.id;

    const account = await prisma.hostingAccount.create({
      data: { customerId, hostingPlanId: starterPlanId, provider: "mock", providerAccountId: `mock_${SUFFIX}`, status: "ACTIVE" },
    });
    accountId = account.id;

    const subscription = await prisma.subscription.create({
      data: { customerId, type: "HOSTING", referenceId: accountId, status: "ACTIVE", amount: 12, billingCycle: "MONTHLY" },
    });
    subscriptionId = subscription.id;
  });

  afterAll(async () => {
    // Guard against beforeAll having thrown before these ids were assigned --
    // an unscoped `where: { hostingAccountId: undefined }` matches every row
    // in the table, so without this a setup failure would wipe unrelated data.
    if (!customerId || !accountId || !starterPlanId || !businessPlanId) return;

    await prisma.deploymentTarget.deleteMany({ where: { hostingAccountId: accountId } });
    await prisma.subscription.deleteMany({ where: { referenceId: accountId } });
    await prisma.hostingAccount.delete({ where: { id: accountId } });
    await prisma.hostingPlan.deleteMany({ where: { id: { in: [starterPlanId, businessPlanId] } } });
    await prisma.notification.deleteMany({ where: { userId: customerId } });
    await prisma.auditLog.deleteMany({ where: { actorId: customerId } });
    await prisma.user.delete({ where: { id: customerId } });
  });

  it("upgrades the account and re-prices the linked subscription", async () => {
    await changeHostingPlan(accountId, businessPlanId, customerId);

    const account = await prisma.hostingAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(account.hostingPlanId).toBe(businessPlanId);

    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(Number(subscription.amount)).toBe(35);

    const auditLog = await prisma.auditLog.findFirst({ where: { resourceId: accountId, action: "hosting.upgraded" } });
    expect(auditLog).not.toBeNull();
  });

  it("rejects changing to the same plan already active", async () => {
    await expect(changeHostingPlan(accountId, businessPlanId, customerId)).rejects.toThrow();
  });

  it("downgrades the account back to the starter plan", async () => {
    await changeHostingPlan(accountId, starterPlanId, customerId);
    const account = await prisma.hostingAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(account.hostingPlanId).toBe(starterPlanId);

    const auditLog = await prisma.auditLog.findFirst({ where: { resourceId: accountId, action: "hosting.downgraded" } });
    expect(auditLog).not.toBeNull();
  });

  it("suspends and unsuspends the account", async () => {
    await suspendHostingAccount(accountId, customerId);
    expect((await prisma.hostingAccount.findUniqueOrThrow({ where: { id: accountId } })).status).toBe("SUSPENDED");

    await unsuspendHostingAccount(accountId, customerId);
    expect((await prisma.hostingAccount.findUniqueOrThrow({ where: { id: accountId } })).status).toBe("ACTIVE");
  });

  it("terminates the account and cancels its subscription", async () => {
    await terminateHostingAccount(accountId, customerId);

    const account = await prisma.hostingAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(account.status).toBe("TERMINATED");

    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(subscription.status).toBe("CANCELLED");
    expect(subscription.cancelledAt).not.toBeNull();
  });
}, 30000);
