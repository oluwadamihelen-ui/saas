"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/require";
import { checkoutSchema, initiateCheckout } from "@/lib/services/checkout";
import { logger } from "@/lib/security/logger";
import { checkRateLimit } from "@/lib/security/rate-limit";

const CHECKOUT_LIMIT = 10;
const CHECKOUT_WINDOW_SECONDS = 60;

export interface CheckoutFormState {
  status: "idle" | "error";
  message?: string;
}

export async function submitCheckout(_prev: CheckoutFormState, formData: FormData): Promise<CheckoutFormState> {
  const user = await requireUser();

  // Each successful submit calls the payment provider's createPayment API
  // and creates an Order -- caps how many a single account can spam in a
  // minute (accidental double-clicks are well under this; scripted abuse
  // isn't).
  const rateLimit = await checkRateLimit(`checkout:${user.id}`, CHECKOUT_LIMIT, CHECKOUT_WINDOW_SECONDS);
  if (!rateLimit.allowed) {
    return { status: "error", message: "Too many checkout attempts. Please wait a moment and try again." };
  }

  const parsed = checkoutSchema.safeParse({
    applicationId: formData.get("applicationId"),
    includeInstallation: formData.get("includeInstallation") === "on",
    hostingPlanId: formData.get("hostingPlanId") || undefined,
    deploymentType: formData.get("deploymentType"),
    serverHost: formData.get("serverHost") || undefined,
    serverPort: formData.get("serverPort") || undefined,
    controlPanel: formData.get("controlPanel") || undefined,
    domainName: formData.get("domainName") || undefined,
    couponCode: formData.get("couponCode") || undefined,
    billingName: formData.get("billingName"),
    billingEmail: formData.get("billingEmail"),
    billingPhone: formData.get("billingPhone") || undefined,
    billingCompany: formData.get("billingCompany") || undefined,
    billingCountry: formData.get("billingCountry") || undefined,
    billingAddress: formData.get("billingAddress") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the form for errors." };
  }

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const appOrigin = process.env.APP_URL ?? `${protocol}://${host}`;

  let authorizationUrl: string | null;
  try {
    const result = await initiateCheckout(user.id, parsed.data, appOrigin);
    authorizationUrl = result.authorizationUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logger.error("checkout.failed", { error: message });
    return { status: "error", message: error instanceof Error ? message : "We couldn't start checkout. Please try again." };
  }

  if (!authorizationUrl) {
    return { status: "error", message: "Payment provider did not return a checkout link." };
  }

  redirect(authorizationUrl);
}
