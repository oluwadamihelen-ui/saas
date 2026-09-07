import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createOrder, markOrderPaid } from "@/lib/services/orders";
import { getDeveloperCommissionRate } from "@/lib/services/settings";

/**
 * Phase 7 acceptance test for developer revenue share: a direct
 * APPLICATION_LICENSE purchase of an application authored by a DEVELOPER
 * generates a Commission row inside markOrderPaid's transaction, using the
 * platform's configured commission rate. A purchase of an application with
 * no developer creator (or a non-developer creator) generates no
 * commission at all.
 */
const SUFFIX = `commission-${Date.now()}`;

describe("commission computation on markOrderPaid", () => {
  let categoryId: string;
  let developerId: string;
  let adminId: string;
  let customerId: string;
  let developerAppId: string;
  let adminAppId: string;

  beforeAll(async () => {
    const customerRole = await prisma.role.upsert({ where: { key: "CUSTOMER" }, update: {}, create: { key: "CUSTOMER", name: "Customer" } });
    const developerRole = await prisma.role.upsert({ where: { key: "DEVELOPER" }, update: {}, create: { key: "DEVELOPER", name: "Developer" } });
    const adminRole = await prisma.role.upsert({ where: { key: "SUPER_ADMIN" }, update: {}, create: { key: "SUPER_ADMIN", name: "Super Admin" } });

    const category = await prisma.category.create({ data: { name: `Commission Test ${SUFFIX}`, slug: `commission-test-${SUFFIX}` } });
    categoryId = category.id;

    const developer = await prisma.user.create({ data: { name: "Commission Test Developer", email: `${SUFFIX}-dev@example.com`, roleId: developerRole.id, status: "ACTIVE" } });
    developerId = developer.id;

    const admin = await prisma.user.create({ data: { name: "Commission Test Admin", email: `${SUFFIX}-admin@example.com`, roleId: adminRole.id, status: "ACTIVE" } });
    adminId = admin.id;

    const customer = await prisma.user.create({ data: { name: "Commission Test Customer", email: `${SUFFIX}-customer@example.com`, roleId: customerRole.id, status: "ACTIVE" } });
    customerId = customer.id;

    const developerApp = await prisma.application.create({
      data: { name: `Developer App ${SUFFIX}`, slug: `developer-app-${SUFFIX}`, categoryId, shortDescription: "Test", fullDescription: "Test", status: "PUBLISHED", createdById: developer.id },
    });
    developerAppId = developerApp.id;

    const adminApp = await prisma.application.create({
      data: { name: `Admin App ${SUFFIX}`, slug: `admin-app-${SUFFIX}`, categoryId, shortDescription: "Test", fullDescription: "Test", status: "PUBLISHED", createdById: admin.id },
    });
    adminAppId = adminApp.id;
  });

  afterAll(async () => {
    if (!categoryId || !developerId || !adminId || !customerId) return;

    const orders = await prisma.order.findMany({ where: { customerId }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    await prisma.commission.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.applicationLicense.deleteMany({ where: { customerId } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { orderId: { in: orderIds } } } });
    await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.notification.deleteMany({ where: { userId: customerId } });
    await prisma.application.deleteMany({ where: { id: { in: [developerAppId, adminAppId] } } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: { in: [developerId, adminId, customerId] } } });
  });

  it("creates a Commission for a developer-authored app once payment clears", async () => {
    const order = await createOrder(
      customerId,
      [{ type: "APPLICATION_LICENSE", applicationId: developerAppId, description: "Developer App — License", billingCycle: "ONE_TIME", quantity: 1, unitPrice: 200 }],
      { billingName: "Commission Test Customer", billingEmail: `${SUFFIX}-customer@example.com` }
    );

    await markOrderPaid(order.id, { provider: "mock", providerRef: `mock_${SUFFIX}_dev`, amount: 200, currency: order.currency });

    const commission = await prisma.commission.findFirst({ where: { orderId: order.id } });
    expect(commission).not.toBeNull();
    expect(commission!.developerId).toBe(developerId);
    expect(commission!.applicationId).toBe(developerAppId);
    expect(commission!.status).toBe("PENDING");

    const rate = await getDeveloperCommissionRate();
    expect(Number(commission!.rate)).toBe(rate);
    expect(Number(commission!.saleAmount)).toBe(200);
    expect(Number(commission!.amount)).toBe(Math.round(200 * rate * 100) / 100);
  });

  it("creates no commission for an app with no developer creator", async () => {
    const order = await createOrder(
      customerId,
      [{ type: "APPLICATION_LICENSE", applicationId: adminAppId, description: "Admin App — License", billingCycle: "ONE_TIME", quantity: 1, unitPrice: 150 }],
      { billingName: "Commission Test Customer", billingEmail: `${SUFFIX}-customer@example.com` }
    );

    await markOrderPaid(order.id, { provider: "mock", providerRef: `mock_${SUFFIX}_admin`, amount: 150, currency: order.currency });

    const commission = await prisma.commission.findFirst({ where: { orderId: order.id } });
    expect(commission).toBeNull();

    const license = await prisma.applicationLicense.findFirst({ where: { orderId: order.id } });
    expect(license).not.toBeNull();
  });
}, 30000);
