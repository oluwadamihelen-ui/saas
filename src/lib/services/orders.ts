import { prisma } from "@/lib/db";
import { generateInvoiceNumber, generateLicenseKey, generateOrderNumber } from "@/lib/utils/ids";
import { OrderItemType, BillingCycle } from "@/generated/prisma/client";
import { notifyUser } from "@/lib/services/notifications";
import { getPlatformCurrency } from "@/lib/services/settings";
import { logger } from "@/lib/security/logger";

export interface CartLineInput {
  type: OrderItemType;
  applicationId?: string;
  applicationPricingId?: string;
  hostingPlanId?: string;
  description: string;
  billingCycle: BillingCycle;
  quantity: number;
  unitPrice: number;
}

export interface BillingDetailsInput {
  billingName: string;
  billingEmail: string;
  billingPhone?: string;
  billingCompany?: string;
  billingCountry?: string;
  billingAddress?: string;
}

const TAX_RATE = 0; // configurable via Setting in a later phase

export async function createOrder(customerId: string, lines: CartLineInput[], billing: BillingDetailsInput) {
  if (lines.length === 0) throw new Error("Cannot create an order with no items");

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const discount = 0;
  const total = subtotal + tax - discount;
  const currency = await getPlatformCurrency();

  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      customerId,
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      subtotal,
      discount,
      tax,
      total,
      currency,
      ...billing,
      items: {
        create: lines.map((l) => ({
          type: l.type,
          applicationId: l.applicationId,
          applicationPricingId: l.applicationPricingId,
          hostingPlanId: l.hostingPlanId,
          description: l.description,
          billingCycle: l.billingCycle,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: l.unitPrice * l.quantity,
        })),
      },
    },
    include: { items: true },
  });

  logger.info("order.created", { orderId: order.id, orderNumber: order.orderNumber, total });
  return order;
}

/**
 * Called after a payment provider confirms success (webhook or verified
 * redirect). Idempotent: safe to call more than once for the same order.
 */
export async function markOrderPaid(orderId: string, payment: { provider: string; providerRef: string; amount: number; currency: string }) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, customer: true } });
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (order.paymentStatus === "PAID") return order; // idempotent

  // Defense in depth: callers (webhook route, callback reconciliation) are
  // expected to validate amount/currency before invoking this, but never
  // trust that alone -- the authoritative write path re-checks too.
  const expectedTotal = Number(order.total);
  if (Math.abs(payment.amount - expectedTotal) >= 0.01) {
    throw new Error(`Payment amount ${payment.amount} ${payment.currency} does not match order total ${expectedTotal} ${order.currency}`);
  }
  if (payment.currency.toUpperCase() !== order.currency.toUpperCase()) {
    throw new Error(`Payment currency ${payment.currency} does not match order currency ${order.currency}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        orderId: order.id,
        provider: payment.provider,
        providerRef: payment.providerRef,
        amount: payment.amount,
        currency: payment.currency,
        status: "PAID",
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PROCESSING",
        paymentStatus: "PAID",
        paymentProvider: payment.provider,
        transactionRef: payment.providerRef,
      },
    });

    await tx.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(),
        orderId: order.id,
        customerId: order.customerId,
        status: "PAID",
        subtotal: order.subtotal,
        discount: order.discount,
        tax: order.tax,
        total: order.total,
        currency: order.currency,
        paidAt: new Date(),
        items: {
          create: order.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        },
      },
    });

    // Issue a license for each application license line item purchased.
    const licenseLines = order.items.filter((i) => i.type === "APPLICATION_LICENSE" && i.applicationId);
    for (const line of licenseLines) {
      await tx.applicationLicense.create({
        data: {
          licenseKey: generateLicenseKey(),
          customerId: order.customerId,
          applicationId: line.applicationId!,
          orderId: order.id,
          type: "STANDARD",
          status: "ACTIVE",
        },
      });
    }
  });

  await notifyUser(order.customerId, {
    type: "order.paid",
    title: "Payment received",
    message: `Payment for order ${order.orderNumber} was successful. We're getting your order ready.`,
    data: { orderId: order.id },
  });

  logger.info("order.paid", { orderId: order.id, provider: payment.provider });

  return prisma.order.findUnique({ where: { id: order.id } });
}

export async function getOrderForCustomer(orderId: string, customerId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, customerId },
    include: {
      items: { include: { application: true, hostingPlan: true } },
      payments: true,
      invoice: true,
      deployments: true,
    },
  });
}

export async function listOrdersForCustomer(customerId: string) {
  return prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
}
