import { createHmac, timingSafeEqual } from "node:crypto";

const KORAPAY_API_BASE = "https://api.korapay.com/merchant/api/v1";

export class KorapayApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
  }
}

interface KorapayResponseEnvelope {
  status: boolean;
  message: string;
  data: unknown;
}

async function korapayRequest<T>(secretKey: string, path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${KORAPAY_API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json", ...init.headers },
  });
  const body = (await response.json()) as KorapayResponseEnvelope;
  if (!response.ok || body.status === false) {
    throw new KorapayApiError(body.message ?? `Korapay request to ${path} failed (${response.status})`, response.status, body);
  }
  return body.data as T;
}

export interface InitializeChargeParams {
  /** Korapay wants the MAJOR currency unit (e.g. naira, not kobo) — unlike
   * Paystack, which wants the minor unit. Callers must convert before
   * passing this in; this client doesn't silently rescale for you. */
  amount: number;
  currency: string;
  reference: string;
  customerEmail: string;
  redirectUrl: string;
  notificationUrl: string;
}

export interface InitializeChargeResult {
  checkout_url: string;
  reference: string;
}

export interface ResolveAccountParams {
  bankCode: string;
  accountNumber: string;
}

export interface ResolveAccountResult {
  account_name: string;
  account_number: string;
}

export interface InitiateDisbursementParams {
  amount: number; // major currency unit, same convention as initializeCharge
  currency: string;
  reference: string;
  bankCode: string;
  accountNumber: string;
  customerName: string;
  customerEmail: string;
  narration: string;
}

export interface InitiateDisbursementResult {
  reference: string;
  status: string;
}

export function createKorapayClient(secretKey: string) {
  return {
    /** POST /charges/initialize — one-time charge; returns a hosted checkout_url to redirect the customer to. */
    initializeCharge(params: InitializeChargeParams): Promise<InitializeChargeResult> {
      return korapayRequest<InitializeChargeResult>(secretKey, "/charges/initialize", {
        method: "POST",
        body: JSON.stringify({
          amount: params.amount,
          currency: params.currency,
          reference: params.reference,
          customer: { email: params.customerEmail },
          redirect_url: params.redirectUrl,
          notification_url: params.notificationUrl,
        }),
      });
    },

    /**
     * POST /misc/banks/resolve — verifies an account number against a bank
     * code before it's saved as a payout destination. Field names here
     * (`bank`/`account` in the request body) are inferred from secondary
     * sources — developers.korapay.com is blocked by this environment's
     * network egress policy, so this couldn't be confirmed against the
     * official page directly. Worth a smoke test against Korapay's sandbox
     * before relying on it in production.
     */
    resolveAccountNumber(params: ResolveAccountParams): Promise<ResolveAccountResult> {
      return korapayRequest(secretKey, "/misc/banks/resolve", {
        method: "POST",
        body: JSON.stringify({ bank: params.bankCode, account: params.accountNumber }),
      });
    },

    /**
     * POST /transactions/disburse — moves money from the platform's Korapay
     * balance to a creator's bank account, no pre-created recipient needed
     * (unlike Paystack). Same field-name caveat as resolveAccountNumber
     * above: inferred from secondary sources, not a directly confirmed
     * official example.
     */
    initiateDisbursement(params: InitiateDisbursementParams): Promise<InitiateDisbursementResult> {
      return korapayRequest(secretKey, "/transactions/disburse", {
        method: "POST",
        body: JSON.stringify({
          reference: params.reference,
          amount: params.amount,
          currency: params.currency,
          narration: params.narration,
          bank_account: { bank: params.bankCode, account: params.accountNumber },
          customer: { name: params.customerName, email: params.customerEmail },
        }),
      });
    },
  };
}

/**
 * Korapay's x-korapay-signature is an HMAC-SHA256 of ONLY the `data` object
 * in the webhook payload (not the full request body, unlike Paystack) —
 * confirmed against Korapay's own published verification example, which
 * hashes `JSON.stringify(req.body.data)`, not `req.body` itself. Callers
 * pass the already-serialized data object's JSON string.
 */
export function verifyKorapayWebhookSignature(dataJson: string, signature: string, secretKey: string): boolean {
  const expected = createHmac("sha256", secretKey).update(dataJson).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const signatureBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== signatureBuf.length) return false;
  return timingSafeEqual(expectedBuf, signatureBuf);
}

// ---------------------------------------------------------------------------
// Webhook event shapes — hand-rolled, minimal: Korapay has no official TS
// SDK, so these cover only the fields this codebase actually reads.
// ---------------------------------------------------------------------------

export interface KorapayChargeEventData {
  reference: string;
  currency: string;
  amount: number;
  status: string;
}

export interface KorapayRefundEventData {
  reference: string;
  payment_reference: string;
  currency: string;
  amount: number;
  status: string;
}

export interface KorapayTransferEventData {
  reference: string;
  amount: number;
  currency: string;
  status: string;
  fee?: number;
}

export type KorapayWebhookEvent =
  | { event: "charge.success" | "charge.failed"; data: KorapayChargeEventData }
  | { event: "refund.success" | "refund.failed"; data: KorapayRefundEventData }
  | { event: "transfer.success" | "transfer.failed"; data: KorapayTransferEventData }
  | { event: string; data: unknown };

export const HANDLED_KORAPAY_EVENTS = new Set(["charge.success", "refund.success", "transfer.success", "transfer.failed"]);
