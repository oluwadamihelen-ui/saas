import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateQuoteNumber } from "@/lib/utils/ids";
import { createOrder } from "@/lib/services/orders";
import { getPaymentProvider } from "@/lib/providers/registry";
import { notifyUser } from "@/lib/services/notifications";
import { recordAuditLog } from "@/lib/security/audit";
import { logger } from "@/lib/security/logger";

export const quoteLineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().int().positive().default(1),
  unitPrice: z.coerce.number().nonnegative(),
});

export const createQuoteSchema = z.object({
  requestId: z.string().uuid(),
  items: z.array(quoteLineSchema).min(1, "Add at least one line item."),
  taxRate: z.coerce.number().min(0).max(1).default(0),
  expiresInDays: z.coerce.number().int().positive().default(14),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

/**
 * Admin prices a CustomizationRequest: creates the Quote + QuoteItems, moves
 * the request to QUOTED, and notifies the customer. Sent immediately rather
 * than left in DRAFT -- there's no separate "review before sending" UI, so
 * submitting the pricing form is the send action.
 */
export async function createQuote(actorId: string, input: CreateQuoteInput) {
  const request = await prisma.customizationRequest.findUniqueOrThrow({ where: { id: input.requestId } });

  const subtotal = input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const tax = Math.round(subtotal * input.taxRate * 100) / 100;
  const total = subtotal + tax;
  const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);

  const quote = await prisma.quote.create({
    data: {
      quoteNumber: generateQuoteNumber(),
      customerId: request.customerId,
      subtotal,
      tax,
      total,
      status: "SENT",
      expiresAt,
      items: { create: input.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, total: i.unitPrice * i.quantity })) },
    },
    include: { items: true },
  });

  await prisma.customizationRequest.update({ where: { id: request.id }, data: { status: "QUOTED", quoteId: quote.id } });

  await recordAuditLog({
    actorId,
    action: "quote.created",
    resourceType: "Quote",
    resourceId: quote.id,
    newValue: { requestId: request.id, total },
  });
  await notifyUser(request.customerId, {
    type: "quote.received",
    title: "Your quote is ready",
    message: `We've priced your custom work request — quote ${quote.quoteNumber} totals ${quote.currency} ${total.toFixed(2)}. Review and accept it to get started.`,
  });

  return quote;
}

/**
 * Starts payment for an accepted quote the same way any other purchase
 * does: creates an Order (one CUSTOMIZATION line per QuoteItem) and hands
 * off to the payment provider. The Quote is linked to the order immediately
 * but only actually marked ACCEPTED once payment clears (processQuoteOrder,
 * called from fulfillOrder) -- mirrors how a DomainOrder stays PENDING
 * until fulfillment confirms it, rather than trusting accept-intent alone.
 */
export async function convertQuoteToOrder(quoteId: string, customerId: string, appOrigin: string) {
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, customerId }, include: { items: true } });
  if (!quote) throw new Error("Quote not found");
  if (quote.status !== "SENT") throw new Error(`This quote is ${quote.status.toLowerCase()} and can't be accepted.`);
  if (quote.expiresAt && quote.expiresAt < new Date()) {
    await prisma.quote.update({ where: { id: quote.id }, data: { status: "EXPIRED" } });
    throw new Error("This quote has expired. Please request a new one.");
  }

  const customer = await prisma.user.findUniqueOrThrow({ where: { id: customerId } });

  const order = await createOrder(
    customerId,
    quote.items.map((item) => ({
      type: "CUSTOMIZATION" as const,
      description: item.description,
      billingCycle: "ONE_TIME" as const,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
    })),
    { billingName: customer.name ?? customer.email, billingEmail: customer.email }
  );

  await prisma.quote.update({ where: { id: quote.id }, data: { orderId: order.id } });

  const paymentProvider = await getPaymentProvider();
  const payment = await paymentProvider.createPayment({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: Number(order.total),
    currency: order.currency,
    customerEmail: customer.email,
    customerName: customer.name ?? customer.email,
    callbackUrl: `${appOrigin}/checkout/callback?orderId=${order.id}`,
    metadata: { orderId: order.id, quoteId: quote.id },
  });
  await prisma.order.update({ where: { id: order.id }, data: { transactionRef: payment.providerReference, paymentProvider: paymentProvider.key } });

  logger.info("quote.accept_initiated", { quoteId: quote.id, orderId: order.id });

  return { orderId: order.id, authorizationUrl: payment.authorizationUrl };
}

/**
 * Finalizes an accepted quote once its order is actually paid -- called
 * from fulfillOrder alongside the domain/hosting post-payment processing.
 * A no-op if this order isn't tied to a quote.
 */
export async function processQuoteOrder(orderId: string) {
  const quote = await prisma.quote.findUnique({ where: { orderId } });
  if (!quote || quote.status === "ACCEPTED") return;

  await prisma.quote.update({ where: { id: quote.id }, data: { status: "ACCEPTED" } });
  await prisma.customizationRequest.updateMany({ where: { quoteId: quote.id }, data: { status: "CONVERTED" } });

  await recordAuditLog({ actorId: quote.customerId, action: "quote.accepted", resourceType: "Quote", resourceId: quote.id, newValue: { orderId } });
  await notifyUser(quote.customerId, {
    type: "quote.accepted",
    title: "Quote accepted",
    message: `Payment received for quote ${quote.quoteNumber}. We'll be in touch to get started.`,
    sendEmail: false,
  });
}
