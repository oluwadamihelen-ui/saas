import { z } from "zod";
import { prisma } from "@/lib/db";
import { createOrder, type CartLineInput } from "@/lib/services/orders";
import { getDomainProvider, getPaymentProvider } from "@/lib/providers/registry";
import { logger } from "@/lib/security/logger";

const DOMAIN_REGISTRATION_YEARS = 1;

export const checkoutSchema = z.object({
  applicationId: z.string().uuid(),
  includeInstallation: z.coerce.boolean().default(false),
  hostingPlanId: z.string().uuid().optional().or(z.literal("")),
  deploymentType: z.enum(["CUSTOMER_SERVER", "PLATFORM_HOSTING", "MANAGED"]),
  serverHost: z.string().trim().max(255).optional().or(z.literal("")),
  serverPort: z.coerce.number().int().min(1).max(65535).optional(),
  controlPanel: z.string().trim().max(80).optional().or(z.literal("")),
  domainName: z.string().trim().max(255).optional().or(z.literal("")),
  billingName: z.string().trim().min(1).max(200),
  billingEmail: z.string().trim().email(),
  billingPhone: z.string().trim().max(40).optional().or(z.literal("")),
  billingCompany: z.string().trim().max(200).optional().or(z.literal("")),
  billingCountry: z.string().trim().max(80).optional().or(z.literal("")),
  billingAddress: z.string().trim().max(500).optional().or(z.literal("")),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export async function initiateCheckout(customerId: string, input: CheckoutInput, appOrigin: string) {
  const application = await prisma.application.findUniqueOrThrow({
    where: { id: input.applicationId },
    include: { pricing: { where: { isActive: true } } },
  });

  const license = application.pricing.find((p) => p.type === "LICENSE");
  if (!license) throw new Error("This application has no license price configured");

  const lines: CartLineInput[] = [
    {
      type: "APPLICATION_LICENSE",
      applicationId: application.id,
      applicationPricingId: license.id,
      description: `${application.name} — Software License`,
      billingCycle: license.billingCycle,
      quantity: 1,
      unitPrice: Number(license.amount),
    },
  ];

  if (input.includeInstallation) {
    const installation = application.pricing.find((p) => p.type === "INSTALLATION");
    if (installation) {
      lines.push({
        type: "INSTALLATION",
        applicationId: application.id,
        applicationPricingId: installation.id,
        description: `${application.name} — Installation`,
        billingCycle: installation.billingCycle,
        quantity: 1,
        unitPrice: Number(installation.amount),
      });
    }
  }

  let hostingPlan = null;
  if (input.deploymentType === "PLATFORM_HOSTING" && input.hostingPlanId) {
    hostingPlan = await prisma.hostingPlan.findUnique({ where: { id: input.hostingPlanId } });
    if (hostingPlan) {
      lines.push({
        type: "HOSTING_PLAN",
        hostingPlanId: hostingPlan.id,
        description: `${hostingPlan.name} Hosting`,
        billingCycle: "MONTHLY",
        quantity: 1,
        unitPrice: Number(hostingPlan.priceMonthly),
      });
    }
  }

  const domainName = input.domainName || null;
  let domainQuote: { price: number; currency: string } | null = null;
  if (domainName) {
    const domainProvider = await getDomainProvider();
    const available = await domainProvider.checkAvailability(domainName);
    if (!available) throw new Error(`${domainName} is not available for registration`);
    domainQuote = await domainProvider.getPricingQuote(domainName, DOMAIN_REGISTRATION_YEARS, "register");
    lines.push({
      type: "DOMAIN",
      description: `Domain registration — ${domainName} (${DOMAIN_REGISTRATION_YEARS} year)`,
      billingCycle: "ONE_TIME",
      quantity: 1,
      unitPrice: domainQuote.price,
    });
  }

  const order = await createOrder(
    customerId,
    lines,
    {
      billingName: input.billingName,
      billingEmail: input.billingEmail,
      billingPhone: input.billingPhone || undefined,
      billingCompany: input.billingCompany || undefined,
      billingCountry: input.billingCountry || undefined,
      billingAddress: input.billingAddress || undefined,
    }
  );

  await prisma.order.update({
    where: { id: order.id },
    data: {
      fulfillmentIntent: {
        deploymentType: input.deploymentType,
        serverHost: input.serverHost || null,
        serverPort: input.serverPort ?? null,
        controlPanel: input.controlPanel || null,
        domainName: input.domainName || null,
        hostingPlanId: hostingPlan?.id ?? null,
      },
    },
  });

  if (domainName && domainQuote) {
    await prisma.domainOrder.create({
      data: {
        orderId: order.id,
        domainName,
        action: "REGISTER",
        years: DOMAIN_REGISTRATION_YEARS,
        providerCost: domainQuote.price,
        customerPrice: domainQuote.price,
        status: "PENDING",
      },
    });
  }

  const provider = await getPaymentProvider();
  const payment = await provider.createPayment({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: Number(order.total),
    currency: order.currency,
    customerEmail: input.billingEmail,
    customerName: input.billingName,
    callbackUrl: `${appOrigin}/checkout/callback?orderId=${order.id}`,
    metadata: { orderId: order.id },
  });

  await prisma.order.update({ where: { id: order.id }, data: { transactionRef: payment.providerReference, paymentProvider: provider.key } });

  logger.info("checkout.initiated", { orderId: order.id, provider: provider.key });

  return { orderId: order.id, authorizationUrl: payment.authorizationUrl };
}
