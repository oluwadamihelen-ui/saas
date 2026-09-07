import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { initiateBundleCheckout } from "@/lib/services/bundles";
import { markOrderPaid } from "@/lib/services/orders";
import { fulfillOrder } from "@/lib/services/fulfillment";

/**
 * End-to-end acceptance test for the Phase 6 bundle path: a bundle sold as
 * one flat-priced BUNDLE order item still grants a real ApplicationLicense
 * for each application it bundles once payment clears -- the same effect as
 * buying each app individually, proving markOrderPaid's bundle-unbundling
 * logic actually runs through the standard Order -> Payment pipeline.
 */
const SUFFIX = `bndl-${Date.now()}`;

describe("bundle purchase: checkout -> payment -> per-app license issuance", () => {
  let categoryId: string;
  let customerId: string;
  let bundleId: string;
  let bundleSlug: string;
  let appAId: string;
  let appBId: string;

  beforeAll(async () => {
    const role = await prisma.role.upsert({ where: { key: "CUSTOMER" }, update: {}, create: { key: "CUSTOMER", name: "Customer" } });

    const category = await prisma.category.create({ data: { name: `Bundle Test Category ${SUFFIX}`, slug: `bundle-test-category-${SUFFIX}` } });
    categoryId = category.id;

    const customer = await prisma.user.create({
      data: { name: "Bundle Purchase Test Customer", email: `${SUFFIX}@example.com`, roleId: role.id, status: "ACTIVE" },
    });
    customerId = customer.id;

    const appA = await prisma.application.create({
      data: {
        name: `Bundle App A ${SUFFIX}`,
        slug: `bundle-app-a-${SUFFIX}`,
        categoryId,
        shortDescription: "Bundled test app A",
        fullDescription: "Bundled test app A",
        status: "PUBLISHED",
        pricing: { create: { type: "LICENSE", name: "License", amount: 300, billingCycle: "ONE_TIME" } },
      },
    });
    appAId = appA.id;

    const appB = await prisma.application.create({
      data: {
        name: `Bundle App B ${SUFFIX}`,
        slug: `bundle-app-b-${SUFFIX}`,
        categoryId,
        shortDescription: "Bundled test app B",
        fullDescription: "Bundled test app B",
        status: "PUBLISHED",
        pricing: { create: { type: "LICENSE", name: "License", amount: 250, billingCycle: "ONE_TIME" } },
      },
    });
    appBId = appB.id;

    bundleSlug = `bundle-test-${SUFFIX}`;
    const bundle = await prisma.bundle.create({
      data: {
        name: `Test Bundle ${SUFFIX}`,
        slug: bundleSlug,
        price: 399,
        isActive: true,
        items: {
          create: [
            { type: "APPLICATION", applicationId: appAId, quantity: 1 },
            { type: "APPLICATION", applicationId: appBId, quantity: 1 },
            { type: "SERVICE", serviceLabel: "Onboarding call", quantity: 1 },
          ],
        },
      },
    });
    bundleId = bundle.id;
  });

  afterAll(async () => {
    // Guard against beforeAll having thrown before these ids were assigned --
    // an unscoped `where: { customerId: undefined }` matches every row in
    // the table, so without this a setup failure would wipe unrelated data.
    if (!customerId || !bundleId) return;

    const orders = await prisma.order.findMany({ where: { customerId }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    await prisma.applicationLicense.deleteMany({ where: { customerId } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { orderId: { in: orderIds } } } });
    await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.notification.deleteMany({ where: { userId: customerId } });
    await prisma.auditLog.deleteMany({ where: { actorId: customerId } });
    await prisma.bundleItem.deleteMany({ where: { bundleId } });
    await prisma.bundle.delete({ where: { id: bundleId } });
    await prisma.application.deleteMany({ where: { id: { in: [appAId, appBId] } } });
    await prisma.user.delete({ where: { id: customerId } });
    await prisma.category.delete({ where: { id: categoryId } });
  });

  it("creates an order with a single BUNDLE line item at the bundle's flat price", async () => {
    const { orderId } = await initiateBundleCheckout(
      customerId,
      { bundleId, billingName: "Bundle Buyer", billingEmail: `${SUFFIX}@example.com` },
      "http://localhost:3000"
    );

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.paymentStatus).toBe("PENDING");
    expect(order.items).toHaveLength(1);
    expect(order.items[0].type).toBe("BUNDLE");
    expect(order.items[0].bundleId).toBe(bundleId);
    expect(Number(order.total)).toBe(399);

    // No licenses should exist yet -- issuing them before payment clears
    // would mean granting access for an order that might never be paid.
    const licensesBeforePayment = await prisma.applicationLicense.count({ where: { customerId } });
    expect(licensesBeforePayment).toBe(0);
  });

  it("issues one ApplicationLicense per bundled application once the order is paid", async () => {
    const order = await prisma.order.findFirstOrThrow({ where: { customerId }, orderBy: { createdAt: "desc" } });

    await markOrderPaid(order.id, { provider: "mock", providerRef: `mock_${SUFFIX}`, amount: Number(order.total), currency: order.currency });
    await fulfillOrder(order.id);

    const licenses = await prisma.applicationLicense.findMany({ where: { customerId, orderId: order.id } });
    expect(licenses).toHaveLength(2);
    const licensedAppIds = licenses.map((l) => l.applicationId).sort();
    expect(licensedAppIds).toEqual([appAId, appBId].sort());
    expect(licenses.every((l) => l.status === "ACTIVE")).toBe(true);
  });

  it("rejects checkout against an inactive bundle", async () => {
    await prisma.bundle.update({ where: { id: bundleId }, data: { isActive: false } });

    await expect(
      initiateBundleCheckout(customerId, { bundleId, billingName: "Bundle Buyer", billingEmail: `${SUFFIX}@example.com` }, "http://localhost:3000")
    ).rejects.toThrow(/not available/i);

    await prisma.bundle.update({ where: { id: bundleId }, data: { isActive: true } });
  });
}, 30000);
