import { createHmac, timingSafeEqual } from "node:crypto";

const PAYSTACK_API_BASE = "https://api.paystack.co";

export class PaystackApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
  }
}

interface PaystackResponseEnvelope {
  status: boolean;
  message: string;
  data: unknown;
}

async function paystackRequest<T>(secretKey: string, path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${PAYSTACK_API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json", ...init.headers },
  });
  const body = (await response.json()) as PaystackResponseEnvelope;
  if (!response.ok || body.status === false) {
    throw new PaystackApiError(body.message ?? `Paystack request to ${path} failed (${response.status})`, response.status, body);
  }
  return body.data as T;
}

export interface InitializeTransactionParams {
  email: string;
  /** Smallest currency unit (e.g. kobo for NGN) — same convention this codebase already used for Stripe's unit_amount. */
  amount: number;
  reference: string;
  callbackUrl: string;
  /** A Paystack Plan code — passing this turns the transaction into the first charge of a recurring subscription. */
  plan?: string;
  metadata?: Record<string, unknown>;
}

export interface InitializeTransactionResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export function createPaystackClient(secretKey: string) {
  return {
    /** POST /transaction/initialize — one-time charge, or the first charge of a subscription when `plan` is set. */
    initializeTransaction(params: InitializeTransactionParams): Promise<InitializeTransactionResult> {
      return paystackRequest<InitializeTransactionResult>(secretKey, "/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email: params.email,
          amount: params.amount,
          reference: params.reference,
          callback_url: params.callbackUrl,
          plan: params.plan,
          metadata: params.metadata,
        }),
      });
    },

    /**
     * POST /subscription/disable — stops future recurring charges. Requires
     * both the subscription code and its email_token (captured from the
     * subscription.create webhook at creation time; Paystack doesn't expose
     * a way to fetch it again later).
     */
    disableSubscription(params: { code: string; token: string }): Promise<void> {
      return paystackRequest<void>(secretKey, "/subscription/disable", {
        method: "POST",
        body: JSON.stringify({ code: params.code, token: params.token }),
      });
    },
  };
}

/**
 * Every Paystack webhook carries an x-paystack-signature header: a
 * hex-encoded HMAC-SHA512 of the raw request body, keyed with the account's
 * secret key (Paystack has no separate webhook-signing secret the way
 * Stripe does — the secret key itself is the signing key). Constant-time
 * comparison so this can't be timed to leak the expected signature.
 */
export function verifyPaystackWebhookSignature(rawBody: string, signature: string, secretKey: string): boolean {
  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const signatureBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== signatureBuf.length) return false;
  return timingSafeEqual(expectedBuf, signatureBuf);
}

// ---------------------------------------------------------------------------
// Webhook event shapes — hand-rolled, minimal: Paystack has no official TS
// SDK, so these cover only the fields this codebase actually reads, not the
// full documented payload.
// ---------------------------------------------------------------------------

interface PaystackCustomer {
  email: string;
  customer_code: string;
}

interface PaystackPlan {
  plan_code: string;
  interval: string;
}

export interface PaystackSubscriptionEventData {
  subscription_code: string;
  email_token: string;
  status: string;
  customer: PaystackCustomer;
  plan: PaystackPlan;
  next_payment_date?: string | null;
}

export interface PaystackInvoiceEventData {
  subscription: { subscription_code: string };
  customer: PaystackCustomer;
}

export type PaystackWebhookEvent =
  | { event: "subscription.create" | "subscription.disable" | "subscription.not_renew"; data: PaystackSubscriptionEventData }
  | { event: "invoice.payment_failed"; data: PaystackInvoiceEventData }
  | { event: string; data: unknown };

export const HANDLED_PAYSTACK_SUBSCRIPTION_EVENTS = new Set(["subscription.create", "subscription.disable", "subscription.not_renew", "invoice.payment_failed"]);
