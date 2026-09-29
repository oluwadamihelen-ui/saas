import { prisma } from "@/lib/db";
import { logger } from "@/lib/security/logger";
import { confirmOnlinePayment, verifyOnlinePaymentWithProvider } from "@/lib/services/payments";
import { getProviderKeys, PROVIDER_ADAPTERS } from "./registry";
import type { PaymentProviderType } from "@/generated/prisma/enums";

/**
 * Shared logic behind all three provider webhook routes. Security model:
 * 1. Extract our own Payment.reference from the payload (whatever shape
 *    this provider uses) and look up the Payment row -- this only reveals
 *    which hotel/provider to check against, it does not trust anything else
 *    in the payload yet.
 * 2. Verify the request signature using THAT hotel's own stored secret for
 *    this provider. A forged request naming a real reference still fails
 *    here without the real secret.
 * 3. Re-fetch the transaction directly from the provider's API (never trust
 *    the webhook body's amount/status) and only then mark the payment
 *    complete.
 */
export async function handleProviderWebhook(provider: PaymentProviderType, rawBody: string, headers: Headers): Promise<{ status: number; body: string }> {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: "invalid json" };
  }

  const adapter = PROVIDER_ADAPTERS[provider];
  const reference = adapter.extractReference(payload);
  if (!reference) return { status: 400, body: "no reference in payload" };

  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment) {
    // Not necessarily an attack -- could be a webhook for a reference this
    // system never created (wrong account, stale test data). Log and ack.
    logger.warn("payments.webhook_unknown_reference", { provider, reference });
    return { status: 200, body: "ok" };
  }
  if (payment.provider !== provider) {
    logger.warn("payments.webhook_provider_mismatch", { provider, reference, expected: payment.provider });
    return { status: 400, body: "provider mismatch" };
  }

  const resolved = await getProviderKeys(payment.hotelId, provider);
  if (!resolved) {
    logger.warn("payments.webhook_no_keys", { provider, hotelId: payment.hotelId });
    return { status: 400, body: "no credentials on file" };
  }

  const validSignature = adapter.verifyWebhookSignature(resolved.keys, rawBody, headers);
  if (!validSignature) {
    logger.warn("payments.webhook_bad_signature", { provider, reference, hotelId: payment.hotelId });
    return { status: 401, body: "invalid signature" };
  }

  try {
    const verified = await verifyOnlinePaymentWithProvider(payment.hotelId, provider, reference);
    if (!verified.success) {
      logger.info("payments.webhook_not_successful", { provider, reference, status: verified.status });
      return { status: 200, body: "ok" };
    }
    await confirmOnlinePayment(payment.hotelId, reference, verified.amount);
    return { status: 200, body: "ok" };
  } catch (error) {
    logger.error("payments.webhook_processing_failed", { provider, reference, error: error instanceof Error ? error.message : String(error) });
    // 200 here: the signature was valid and the failure is on our side (or
    // an amount mismatch worth investigating manually) -- returning an
    // error status would just cause the provider to retry the same
    // already-logged failure indefinitely.
    return { status: 200, body: "ok" };
  }
}
