import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";

const SUFFIX = `registrant-guard-${Date.now()}`;

/**
 * Real registrars (Namecheap included) require a full WHOIS registrant
 * contact per ICANN policy -- this stubs a fake "real" domain provider
 * (capabilities.requiresRegistrantContact: true) rather than pointing
 * DOMAIN_PROVIDER at Namecheap itself, so this test doesn't depend on
 * network access or real credentials. It proves initiateDomainOrder's
 * guard, not Namecheap's HTTP behavior (that's namecheap-provider.test.ts).
 */
const fakeRealRegistrar = {
  key: "fake-real-registrar",
  label: "Fake Real Registrar",
  capabilities: { requiresRegistrantContact: true },
  testConnection: vi.fn(),
  checkAvailability: vi.fn().mockResolvedValue(true),
  getPricingQuote: vi.fn().mockResolvedValue({ price: 12.99, currency: "USD" }),
};

vi.mock("@/lib/providers/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/providers/registry")>();
  return { ...actual, getDomainProvider: vi.fn().mockResolvedValue(fakeRealRegistrar) };
});

const { initiateDomainOrder } = await import("@/lib/services/domain-orders");

describe("initiateDomainOrder: registrant-contact guard for real registrars", () => {
  let customerId: string;

  beforeAll(async () => {
    const role = await prisma.role.upsert({ where: { key: "CUSTOMER" }, update: {}, create: { key: "CUSTOMER", name: "Customer" } });
    const customer = await prisma.user.create({
      data: { name: "Guard Test Customer", email: `${SUFFIX}@example.com`, roleId: role.id, status: "ACTIVE" },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    if (!customerId) return;
    const orders = await prisma.order.findMany({ where: { customerId }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    await prisma.domainOrder.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.user.delete({ where: { id: customerId } });
  });

  it("refuses to start checkout when the customer's profile has no registrant address", async () => {
    await expect(
      initiateDomainOrder(customerId, { action: "REGISTER", domainName: `${SUFFIX}.com`, years: 1 }, "http://localhost:3000")
    ).rejects.toThrow(/complete your profile/i);

    const orderCount = await prisma.order.count({ where: { customerId } });
    expect(orderCount).toBe(0);
  });

  it("proceeds once the profile has a full registrant contact", async () => {
    await prisma.user.update({
      where: { id: customerId },
      data: {
        addressLine1: "1 Example Street",
        city: "Lagos",
        stateProvince: "Lagos",
        postalCode: "100001",
        country: "Nigeria",
        phone: "+234.8012345678",
      },
    });

    const result = await initiateDomainOrder(customerId, { action: "REGISTER", domainName: `${SUFFIX}.com`, years: 1 }, "http://localhost:3000");
    expect(result.orderId).toBeTruthy();

    const domainOrder = await prisma.domainOrder.findFirstOrThrow({ where: { orderId: result.orderId } });
    expect(domainOrder.status).toBe("PENDING");
  });
});
