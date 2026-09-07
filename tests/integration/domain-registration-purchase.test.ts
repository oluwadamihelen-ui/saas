import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { getDomainProvider } from "@/lib/providers/registry";
import { initiateDomainOrder } from "@/lib/services/domain-orders";
import { markOrderPaid } from "@/lib/services/orders";
import { fulfillOrder } from "@/lib/services/fulfillment";

/**
 * End-to-end acceptance test for the Phase 4 purchase path: a customer buys
 * a brand-new domain (no application involved), pays, and the registrar
 * call only happens once payment is confirmed -- proving the DomainOrder
 * ledger (register/renew) is wired through the same Order -> Payment ->
 * fulfillOrder pipeline as any other purchase, not a special-cased path.
 */
const SUFFIX = `domreg-${Date.now()}`;

describe("domain registration: order -> payment -> fulfillment", () => {
  let customerId: string;
  // The mock registrar's availability check is a deterministic hash of the
  // domain string (so demos behave consistently) -- about 1 in 3 candidate
  // names comes back "taken". Probe a few candidates rather than assuming
  // the first one is free, so this test isn't randomly flaky.
  let domainName = "";

  beforeAll(async () => {
    const role = await prisma.role.upsert({ where: { key: "CUSTOMER" }, update: {}, create: { key: "CUSTOMER", name: "Customer" } });
    const customer = await prisma.user.create({
      data: { name: "Domain Purchase Test Customer", email: `${SUFFIX}@example.com`, roleId: role.id, status: "ACTIVE" },
    });
    customerId = customer.id;

    const domainProvider = await getDomainProvider();
    for (let i = 0; i < 10; i++) {
      const candidate = `${SUFFIX}-${i}.com`;
      if (await domainProvider.checkAvailability(candidate)) {
        domainName = candidate;
        break;
      }
    }
    if (!domainName) throw new Error("Could not find an available test domain after 10 attempts");
  });

  afterAll(async () => {
    // Guard against beforeAll having thrown before customerId was assigned --
    // an unscoped `where: { customerId: undefined }` matches every row in the
    // table, so without this a setup failure would wipe unrelated data.
    if (!customerId) return;

    const domain = await prisma.domain.findUnique({ where: { name: domainName } });
    if (domain) {
      await prisma.domainOrder.deleteMany({ where: { domainId: domain.id } });
      await prisma.deploymentTarget.deleteMany({ where: { domainId: domain.id } });
      await prisma.domain.delete({ where: { id: domain.id } });
    }
    const orders = await prisma.order.findMany({ where: { customerId }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    await prisma.domainOrder.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { orderId: { in: orderIds } } } });
    await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.notification.deleteMany({ where: { userId: customerId } });
    await prisma.auditLog.deleteMany({ where: { actorId: customerId } });
    await prisma.user.delete({ where: { id: customerId } });
  });

  it("creates an order + pending DomainOrder without touching the registrar until payment clears", async () => {
    const { orderId } = await initiateDomainOrder(customerId, { action: "REGISTER", domainName, years: 1 }, "http://localhost:3000");

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.paymentStatus).toBe("PENDING");
    expect(order.items).toHaveLength(1);
    expect(order.items[0].type).toBe("DOMAIN");

    const domainOrder = await prisma.domainOrder.findFirstOrThrow({ where: { orderId } });
    expect(domainOrder.status).toBe("PENDING");
    expect(domainOrder.action).toBe("REGISTER");

    // No Domain row should exist yet -- registering before payment would mean
    // paying a registrar for an order that might never be paid for.
    const domainBeforePayment = await prisma.domain.findUnique({ where: { name: domainName } });
    expect(domainBeforePayment).toBeNull();
  });

  it("registers the domain once the order is marked paid and fulfilled", async () => {
    const order = await prisma.order.findFirstOrThrow({ where: { customerId }, orderBy: { createdAt: "desc" } });

    await markOrderPaid(order.id, { provider: "mock", providerRef: `mock_${SUFFIX}`, amount: Number(order.total), currency: order.currency });
    await fulfillOrder(order.id);

    const domainOrder = await prisma.domainOrder.findFirstOrThrow({ where: { orderId: order.id } });
    expect(domainOrder.status).toBe("COMPLETED");
    expect(domainOrder.domainId).not.toBeNull();

    const domain = await prisma.domain.findUniqueOrThrow({ where: { name: domainName } });
    expect(domain.status).toBe("ACTIVE");
    expect(domain.customerId).toBe(customerId);
    expect(domain.id).toBe(domainOrder.domainId);

    const notification = await prisma.notification.findFirst({ where: { userId: customerId, type: "domain.registered" } });
    expect(notification).not.toBeNull();
  });
}, 30000);
