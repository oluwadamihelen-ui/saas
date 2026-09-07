import { z } from "zod";
import { prisma } from "@/lib/db";
import { getDomainProvider, getPaymentProvider } from "@/lib/providers/registry";
import { createOrder } from "@/lib/services/orders";
import { logger } from "@/lib/security/logger";

export const domainOrderRequestSchema = z.object({
  action: z.enum(["REGISTER", "RENEW"]),
  domainName: z
    .string()
    .trim()
    .toLowerCase()
    .max(255)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "Enter a valid domain name"),
  domainId: z.string().uuid().optional(),
  years: z.coerce.number().int().min(1).max(10).default(1),
});

export type DomainOrderRequest = z.infer<typeof domainOrderRequestSchema>;

/**
 * Quote-only helper for UI display before the customer commits (e.g. a
 * confirmation card showing "$14.99 for 1 year" before they submit).
 */
export async function getDomainOrderQuote(domainName: string, years: number, action: "REGISTER" | "RENEW") {
  const provider = await getDomainProvider();
  return provider.getPricingQuote(domainName, years, action === "REGISTER" ? "register" : "renew");
}

/**
 * Starts a paid domain registration or renewal: creates a real Order (so it
 * shows up in billing history/invoices like any other purchase) plus a
 * pending DomainOrder ledger row, then hands off to the payment provider the
 * same way application checkout does. The actual registrar call only happens
 * once payment is confirmed (see fulfillment.ts's processDomainOrders) --
 * never before, since we'd otherwise charge a registrar account for an order
 * that might never get paid.
 */
export async function initiateDomainOrder(customerId: string, input: DomainOrderRequest, appOrigin: string) {
  const customer = await prisma.user.findUniqueOrThrow({ where: { id: customerId } });
  const domainProvider = await getDomainProvider();

  let existingDomain: { id: string; name: string } | null = null;
  if (input.action === "REGISTER") {
    const available = await domainProvider.checkAvailability(input.domainName);
    if (!available) throw new Error(`${input.domainName} is not available`);
  } else {
    if (!input.domainId) throw new Error("domainId is required to renew a domain");
    existingDomain = await prisma.domain.findFirst({ where: { id: input.domainId, customerId }, select: { id: true, name: true } });
    if (!existingDomain) throw new Error("Domain not found");
  }

  const domainName = existingDomain?.name ?? input.domainName;
  const quote = await domainProvider.getPricingQuote(domainName, input.years, input.action === "REGISTER" ? "register" : "renew");
  const yearsLabel = `${input.years} ${input.years === 1 ? "year" : "years"}`;

  const order = await createOrder(
    customerId,
    [
      {
        type: "DOMAIN",
        description: `Domain ${input.action === "REGISTER" ? "registration" : "renewal"} — ${domainName} (${yearsLabel})`,
        billingCycle: "ONE_TIME",
        quantity: 1,
        unitPrice: quote.price,
      },
    ],
    { billingName: customer.name ?? customer.email, billingEmail: customer.email }
  );

  await prisma.domainOrder.create({
    data: {
      orderId: order.id,
      domainId: existingDomain?.id,
      domainName,
      action: input.action,
      years: input.years,
      providerCost: quote.price,
      customerPrice: quote.price,
      status: "PENDING",
    },
  });

  const paymentProvider = await getPaymentProvider();
  const payment = await paymentProvider.createPayment({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: Number(order.total),
    currency: order.currency,
    customerEmail: customer.email,
    customerName: customer.name ?? customer.email,
    callbackUrl: `${appOrigin}/checkout/callback?orderId=${order.id}`,
    metadata: { orderId: order.id },
  });

  await prisma.order.update({ where: { id: order.id }, data: { transactionRef: payment.providerReference, paymentProvider: paymentProvider.key } });

  logger.info("domain_order.initiated", { orderId: order.id, action: input.action, domainName });

  return { orderId: order.id, authorizationUrl: payment.authorizationUrl };
}
