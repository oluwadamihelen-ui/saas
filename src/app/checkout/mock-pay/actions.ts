"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { MockPaymentProvider } from "@/lib/providers/payment/mock";
import { logger } from "@/lib/security/logger";

/**
 * Stands in for a real payment provider's hosted checkout submitting its
 * result back to us over a signed server-to-server webhook -- exercised the
 * same way a live Paystack/Stripe webhook would be, just against our own
 * mock endpoint instead of a third party.
 */
export async function confirmMockPayment(formData: FormData) {
  const reference = String(formData.get("ref"));
  const orderId = String(formData.get("orderId"));

  const payload = JSON.stringify({ event: "charge.success", reference, orderId });
  const signature = MockPaymentProvider.signPayload(payload);

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const origin = process.env.APP_URL ?? `${protocol}://${host}`;

  const res = await fetch(`${origin}/api/webhooks/mock`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-mock-signature": signature },
    body: payload,
  });

  if (!res.ok) {
    logger.error("mock_pay.webhook_failed", { orderId, status: res.status });
  }

  redirect(`/checkout/callback?orderId=${orderId}`);
}
