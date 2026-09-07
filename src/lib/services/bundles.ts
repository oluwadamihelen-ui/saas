import { z } from "zod";
import { prisma } from "@/lib/db";
import { BundleItemType } from "@/generated/prisma/client";
import { createOrder, type BillingDetailsInput } from "@/lib/services/orders";
import { getPaymentProvider } from "@/lib/providers/registry";
import { logger } from "@/lib/security/logger";

export const bundleItemSchema = z
  .object({
    type: z.nativeEnum(BundleItemType),
    applicationId: z.string().uuid().optional().or(z.literal("")),
    hostingPlanId: z.string().uuid().optional().or(z.literal("")),
    serviceLabel: z.string().trim().max(200).optional().or(z.literal("")),
    quantity: z.coerce.number().int().positive().default(1),
  })
  .superRefine((item, ctx) => {
    if (item.type === "APPLICATION" && !item.applicationId) {
      ctx.addIssue({ code: "custom", message: "Select an application for this item." });
    }
    if (item.type === "HOSTING_PLAN" && !item.hostingPlanId) {
      ctx.addIssue({ code: "custom", message: "Select a hosting plan for this item." });
    }
    if ((item.type === "SERVICE" || item.type === "DOMAIN") && !item.serviceLabel) {
      ctx.addIssue({ code: "custom", message: "Describe this item." });
    }
  });

export const bundleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens"),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  price: z.coerce.number().positive(),
  items: z.array(bundleItemSchema).min(1, "Add at least one item to the bundle."),
});

export type BundleInput = z.infer<typeof bundleSchema>;

function itemCreateData(item: z.infer<typeof bundleItemSchema>) {
  return {
    type: item.type,
    applicationId: item.type === "APPLICATION" ? item.applicationId || null : null,
    hostingPlanId: item.type === "HOSTING_PLAN" ? item.hostingPlanId || null : null,
    serviceLabel: item.type === "SERVICE" || item.type === "DOMAIN" ? item.serviceLabel || null : null,
    quantity: item.quantity,
  };
}

export async function createBundle(input: BundleInput) {
  const bundle = await prisma.bundle.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      price: input.price,
      items: { create: input.items.map(itemCreateData) },
    },
  });
  logger.info("bundle.created", { bundleId: bundle.id, slug: bundle.slug });
  return bundle;
}

export async function updateBundle(bundleId: string, input: BundleInput) {
  await prisma.$transaction(async (tx) => {
    await tx.bundle.update({
      where: { id: bundleId },
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        price: input.price,
      },
    });
    await tx.bundleItem.deleteMany({ where: { bundleId } });
    await tx.bundleItem.createMany({ data: input.items.map((item) => ({ bundleId, ...itemCreateData(item) })) });
  });
  logger.info("bundle.updated", { bundleId });
}

export async function setBundleActive(bundleId: string, isActive: boolean) {
  await prisma.bundle.update({ where: { id: bundleId }, data: { isActive } });
  logger.info("bundle.active_changed", { bundleId, isActive });
}

export const bundleCheckoutSchema = z.object({
  bundleId: z.string().uuid(),
  couponCode: z.string().trim().max(50).optional().or(z.literal("")),
  billingName: z.string().trim().min(1).max(200),
  billingEmail: z.string().trim().email(),
  billingPhone: z.string().trim().max(40).optional().or(z.literal("")),
  billingCompany: z.string().trim().max(200).optional().or(z.literal("")),
  billingCountry: z.string().trim().max(80).optional().or(z.literal("")),
  billingAddress: z.string().trim().max(500).optional().or(z.literal("")),
});

export type BundleCheckoutInput = z.infer<typeof bundleCheckoutSchema>;

export async function initiateBundleCheckout(customerId: string, input: BundleCheckoutInput, appOrigin: string) {
  const bundle = await prisma.bundle.findFirst({ where: { id: input.bundleId, isActive: true } });
  if (!bundle) throw new Error("This bundle is not available for purchase");

  const billing: BillingDetailsInput = {
    billingName: input.billingName,
    billingEmail: input.billingEmail,
    billingPhone: input.billingPhone || undefined,
    billingCompany: input.billingCompany || undefined,
    billingCountry: input.billingCountry || undefined,
    billingAddress: input.billingAddress || undefined,
  };

  const order = await createOrder(
    customerId,
    [
      {
        type: "BUNDLE",
        bundleId: bundle.id,
        description: `${bundle.name} — Bundle`,
        billingCycle: "ONE_TIME",
        quantity: 1,
        unitPrice: Number(bundle.price),
      },
    ],
    billing,
    input.couponCode || undefined
  );

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

  logger.info("bundle_checkout.initiated", { orderId: order.id, bundleId: bundle.id, provider: provider.key });

  return { orderId: order.id, authorizationUrl: payment.authorizationUrl };
}
