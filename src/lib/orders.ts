import "server-only";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/utils";
import { TenantError } from "@/lib/errors";
import { Prisma } from "@prisma/client";

export type CreateOrderItemInput = { productId: string; quantity: number };

export type CreateOrderInput = {
  businessId: string;
  customerPhone: string;
  customerName?: string;
  items: CreateOrderItemInput[];
  deliveryFee?: number;
  deliveryAddress?: string;
  customerNotes?: string;
  source: "WHATSAPP" | "STOREFRONT" | "DASHBOARD" | "API";
};

/**
 * The single order-creation path shared by the dashboard, the storefront,
 * and the WhatsApp checkout flow — so stock validation, totals math, and
 * customer upsert behavior never drift between channels.
 */
export async function createOrder(input: CreateOrderInput) {
  if (input.items.length === 0) {
    throw new TenantError("An order needs at least one item", 400);
  }

  const products = await prisma.product.findMany({
    where: { id: { in: input.items.map((i) => i.productId) }, businessId: input.businessId },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));
  for (const item of input.items) {
    const product = productMap.get(item.productId);
    if (!product) throw new TenantError(`Product ${item.productId} not found`, 404);
    if (!product.isActive) throw new TenantError(`${product.name} is not currently available`, 400);
    if (product.stockQuantity < item.quantity) {
      throw new TenantError(`${product.name} only has ${product.stockQuantity} in stock`, 400);
    }
  }

  const customer = await prisma.customer.upsert({
    where: { businessId_phone: { businessId: input.businessId, phone: input.customerPhone } },
    create: { businessId: input.businessId, phone: input.customerPhone, name: input.customerName },
    update: input.customerName ? { name: input.customerName } : {},
  });

  const items = input.items.map((i) => {
    const product = productMap.get(i.productId)!;
    const unitPrice = product.price;
    const total = new Prisma.Decimal(unitPrice).mul(i.quantity);
    return {
      productId: product.id,
      productName: product.name,
      quantity: i.quantity,
      unitPrice,
      total,
    };
  });

  const subtotal = items.reduce((sum, i) => sum.add(i.total), new Prisma.Decimal(0));
  const deliveryFee = new Prisma.Decimal(input.deliveryFee ?? 0);
  const total = subtotal.add(deliveryFee);

  const order = await prisma.order.create({
    data: {
      businessId: input.businessId,
      customerId: customer.id,
      orderNumber: generateOrderNumber(),
      source: input.source,
      status: "PENDING",
      paymentStatus: "UNPAID",
      subtotal,
      deliveryFee,
      total,
      deliveryAddress: input.deliveryAddress,
      customerNotes: input.customerNotes,
      items: { create: items },
    },
    include: { items: true, customer: true },
  });

  return order;
}

/**
 * Called only from a server-verified payment confirmation (Paystack
 * webhook or verify-on-return handler). Marking an order paid and reducing
 * inventory happen atomically so stock counts can never drift from paid
 * orders.
 */
export async function markOrderPaid(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new TenantError("Order not found", 404);
    if (order.paymentStatus === "PAID") return order; // idempotent

    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { decrement: item.quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          businessId: order.businessId,
          productId: item.productId,
          type: "SALE",
          quantity: -item.quantity,
          orderId: order.id,
          note: `Order ${order.orderNumber}`,
        },
      });
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: "PAID", status: "CONFIRMED" },
      include: { items: true, customer: true },
    });

    await tx.notification.create({
      data: {
        businessId: order.businessId,
        type: "NEW_ORDER",
        title: "New paid order",
        body: `Order ${order.orderNumber} was paid — ${order.items.length} item(s).`,
        metadata: { orderId: order.id },
      },
    });

    return updated;
  });
}

export const ORDER_STATUS_FLOW = [
  "PENDING",
  "CONFIRMED",
  "PAID",
  "PROCESSING",
  "READY",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;
