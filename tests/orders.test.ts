import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOrder, markOrderPaid } from "@/lib/orders";
import { createUser, createBusinessWithOwner, createProduct } from "./factories";

describe("order creation and payment", () => {
  let business: Awaited<ReturnType<typeof createBusinessWithOwner>>;
  let product: Awaited<ReturnType<typeof createProduct>>;

  beforeAll(async () => {
    const owner = await createUser();
    business = await createBusinessWithOwner(owner.id);
    product = await createProduct(business.id, { name: "5kg Rice", price: 8500, stockQuantity: 10 });
  });

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({ where: { businessId: business.id } });
    await prisma.orderItem.deleteMany({ where: { order: { businessId: business.id } } });
    await prisma.order.deleteMany({ where: { businessId: business.id } });
    await prisma.customer.deleteMany({ where: { businessId: business.id } });
    await prisma.product.deleteMany({ where: { businessId: business.id } });
    await prisma.businessMember.deleteMany({ where: { businessId: business.id } });
    await prisma.business.delete({ where: { id: business.id } });
  });

  it("rejects an order that exceeds available stock", async () => {
    await expect(
      createOrder({
        businessId: business.id,
        customerPhone: "+2348011111111",
        items: [{ productId: product.id, quantity: 999 }],
        source: "DASHBOARD",
      })
    ).rejects.toThrow(/only has/);
  });

  it("creates an order without touching stock until payment is confirmed", async () => {
    const order = await createOrder({
      businessId: business.id,
      customerPhone: "+2348011111111",
      customerName: "Test Customer",
      items: [{ productId: product.id, quantity: 2 }],
      source: "DASHBOARD",
    });

    expect(order.paymentStatus).toBe("UNPAID");
    expect(order.total.toString()).toBe("17000");

    const unchanged = await prisma.product.findUnique({ where: { id: product.id } });
    expect(unchanged?.stockQuantity).toBe(10);

    // Marking paid decrements stock and creates a SALE movement, exactly once.
    await markOrderPaid(order.id);
    const afterPaid = await prisma.product.findUnique({ where: { id: product.id } });
    expect(afterPaid?.stockQuantity).toBe(8);

    const movements = await prisma.inventoryMovement.count({ where: { orderId: order.id, type: "SALE" } });
    expect(movements).toBe(1);

    // Idempotent: calling markOrderPaid again must not double-decrement stock.
    await markOrderPaid(order.id);
    const afterSecondCall = await prisma.product.findUnique({ where: { id: product.id } });
    expect(afterSecondCall?.stockQuantity).toBe(8);

    const movementsAfter = await prisma.inventoryMovement.count({ where: { orderId: order.id, type: "SALE" } });
    expect(movementsAfter).toBe(1);
  });

  it("upserts the same customer by phone number rather than duplicating", async () => {
    const before = await prisma.customer.count({ where: { businessId: business.id, phone: "+2348022222222" } });
    expect(before).toBe(0);

    await createOrder({
      businessId: business.id,
      customerPhone: "+2348022222222",
      customerName: "Repeat Customer",
      items: [{ productId: product.id, quantity: 1 }],
      source: "WHATSAPP",
    });
    await createOrder({
      businessId: business.id,
      customerPhone: "+2348022222222",
      items: [{ productId: product.id, quantity: 1 }],
      source: "WHATSAPP",
    });

    const customers = await prisma.customer.findMany({ where: { businessId: business.id, phone: "+2348022222222" } });
    expect(customers.length).toBe(1);
    expect(customers[0].name).toBe("Repeat Customer");
  });
});
