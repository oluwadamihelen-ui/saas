import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createQuote, convertQuoteToOrder } from "@/lib/services/quotes";
import { markOrderPaid } from "@/lib/services/orders";
import { fulfillOrder } from "@/lib/services/fulfillment";

/**
 * End-to-end acceptance test for the Phase 6 custom-work path: a customer
 * submits a CustomizationRequest, an admin prices it into a Quote, the
 * customer accepts (spawning an Order through the same Order -> Payment
 * pipeline every other purchase uses), and only once that order is paid does
 * the Quote flip to ACCEPTED and the originating request to CONVERTED --
 * proving quote acceptance doesn't finalize anything before payment clears.
 */
const SUFFIX = `qte-${Date.now()}`;

describe("quote conversion: request -> quote -> order -> payment -> fulfillment", () => {
  let customerId: string;
  let adminId: string;
  let requestId: string;
  let quoteId: string;

  beforeAll(async () => {
    const customerRole = await prisma.role.upsert({ where: { key: "CUSTOMER" }, update: {}, create: { key: "CUSTOMER", name: "Customer" } });
    const adminRole = await prisma.role.upsert({ where: { key: "STAFF" }, update: {}, create: { key: "STAFF", name: "Staff" } });

    const customer = await prisma.user.create({
      data: { name: "Quote Test Customer", email: `${SUFFIX}-customer@example.com`, roleId: customerRole.id, status: "ACTIVE" },
    });
    customerId = customer.id;

    const admin = await prisma.user.create({
      data: { name: "Quote Test Admin", email: `${SUFFIX}-admin@example.com`, roleId: adminRole.id, status: "ACTIVE" },
    });
    adminId = admin.id;

    const request = await prisma.customizationRequest.create({
      data: { customerId, description: "Please build a custom reporting export for our finance team.", budget: 1000, status: "SUBMITTED" },
    });
    requestId = request.id;
  });

  afterAll(async () => {
    // Guard against beforeAll having thrown before customerId/adminId were
    // assigned -- an unscoped `where: { customerId: undefined }` matches
    // every row in the table, so without this a setup failure here would
    // silently wipe every Quote and CustomizationRequest, not just this
    // test's own data.
    if (!customerId) return;

    const orders = await prisma.order.findMany({ where: { customerId }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    await prisma.quote.deleteMany({ where: { customerId } });
    await prisma.customizationRequest.deleteMany({ where: { customerId } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { orderId: { in: orderIds } } } });
    await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: [customerId, adminId] } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: [customerId, adminId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [customerId, adminId] } } });
  });

  it("prices the request into a SENT quote and moves the request to QUOTED", async () => {
    const quote = await createQuote(adminId, {
      requestId,
      items: [
        { description: "Custom export module", quantity: 1, unitPrice: 600 },
        { description: "QA pass", quantity: 1, unitPrice: 200 },
      ],
      taxRate: 0,
      expiresInDays: 14,
    });
    quoteId = quote.id;

    expect(quote.status).toBe("SENT");
    expect(Number(quote.subtotal)).toBe(800);
    expect(Number(quote.total)).toBe(800);

    const request = await prisma.customizationRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(request.status).toBe("QUOTED");
    expect(request.quoteId).toBe(quoteId);
  });

  it("creates a pending order when the customer accepts, without touching the quote status yet", async () => {
    const { orderId } = await convertQuoteToOrder(quoteId, customerId, "http://localhost:3000");

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.paymentStatus).toBe("PENDING");
    expect(order.items).toHaveLength(2);
    expect(order.items.every((i) => i.type === "CUSTOMIZATION")).toBe(true);
    expect(Number(order.total)).toBe(800);

    const quote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(quote.orderId).toBe(orderId);
    expect(quote.status).toBe("SENT"); // still pending payment
  });

  it("accepts the quote and converts the request once payment is confirmed", async () => {
    const quote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    const orderId = quote.orderId!;
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    await markOrderPaid(orderId, { provider: "mock", providerRef: `mock_${SUFFIX}`, amount: Number(order.total), currency: order.currency });
    await fulfillOrder(orderId);

    const updatedQuote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(updatedQuote.status).toBe("ACCEPTED");

    const request = await prisma.customizationRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(request.status).toBe("CONVERTED");

    const notification = await prisma.notification.findFirst({ where: { userId: customerId, type: "quote.accepted" } });
    expect(notification).not.toBeNull();
  });

  it("rejecting an already-expired quote fails instead of silently converting it", async () => {
    const request2 = await prisma.customizationRequest.create({
      data: { customerId, description: "Second request to test expiry handling.", status: "SUBMITTED" },
    });
    const expiredQuote = await createQuote(adminId, {
      requestId: request2.id,
      items: [{ description: "Line item", quantity: 1, unitPrice: 100 }],
      taxRate: 0,
      expiresInDays: 14,
    });
    await prisma.quote.update({ where: { id: expiredQuote.id }, data: { expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });

    await expect(convertQuoteToOrder(expiredQuote.id, customerId, "http://localhost:3000")).rejects.toThrow(/expired/i);

    const reloaded = await prisma.quote.findUniqueOrThrow({ where: { id: expiredQuote.id } });
    expect(reloaded.status).toBe("EXPIRED");
  });
}, 30000);
