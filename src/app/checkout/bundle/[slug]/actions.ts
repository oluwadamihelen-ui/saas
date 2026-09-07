"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/require";
import { bundleCheckoutSchema, initiateBundleCheckout } from "@/lib/services/bundles";
import { logger } from "@/lib/security/logger";
import { checkRateLimit } from "@/lib/security/rate-limit";

const CHECKOUT_LIMIT = 10;
const CHECKOUT_WINDOW_SECONDS = 60;

export interface BundleCheckoutFormState {
  status: "idle" | "error";
  message?: string;
}

export async function submitBundleCheckout(_prev: BundleCheckoutFormState, formData: FormData): Promise<BundleCheckoutFormState> {
  const user = await requireUser();

  // Same shared key as the app checkout action -- one counter per customer
  // across both entry points, not one budget each.
  const rateLimit = await checkRateLimit(`checkout:${user.id}`, CHECKOUT_LIMIT, CHECKOUT_WINDOW_SECONDS);
  if (!rateLimit.allowed) {
    return { status: "error", message: "Too many checkout attempts. Please wait a moment and try again." };
  }

  const parsed = bundleCheckoutSchema.safeParse({
    bundleId: formData.get("bundleId"),
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
    const result = await initiateBundleCheckout(user.id, parsed.data, appOrigin);
    authorizationUrl = result.authorizationUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logger.error("bundle_checkout.failed", { error: message });
    return { status: "error", message: error instanceof Error ? message : "We couldn't start checkout. Please try again." };
  }

  if (!authorizationUrl) {
    return { status: "error", message: "Payment provider did not return a checkout link." };
  }

  redirect(authorizationUrl);
}
