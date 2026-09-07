import crypto from "crypto";
import { logger } from "@/lib/security/logger";
import { ProviderTestResult } from "../types";
import {
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentProvider,
  PaymentProviderCapabilities,
  RefundInput,
  RefundResult,
  VerifyPaymentResult,
  WebhookVerificationInput,
} from "./types";

const NOWPAYMENTS_BASE_URL = "https://api.nowpayments.io/v1";

interface NowPaymentsInvoiceResponse {
  id: number | string;
  invoice_url: string;
  order_id: string;
}

interface NowPaymentsRecord {
  order_id: string;
  payment_status: string;
  price_amount: number;
  price_currency: string;
  actually_paid?: number;
}

/**
 * Cryptocurrency payment provider adapter for NOWPayments (api.nowpayments.io).
 * Its API shape differs from Paystack/KoraPay in several ways worth calling
 * out for future maintainers:
 *  - Auth is a single `x-api-key` header, not a Bearer secret key.
 *  - Checkout uses the hosted Invoice flow (POST /invoice) rather than a
 *    "transaction initialize" call -- invoice_url is what the customer is
 *    redirected to.
 *  - `providerReference` is our own generated order_id, not a NOWPayments
 *    invoice/payment id: NOWPayments only allocates its numeric payment_id
 *    once the customer actually starts paying, so it can't be captured at
 *    creation time. Sending our reference as `order_id` on the invoice
 *    means it comes back unchanged in both the IPN body and the
 *    GET /payment?orderId= lookup, so it works as the stable correlation
 *    key Order.transactionRef needs.
 *  - IPN (webhook) signatures are an HMAC-SHA512 of the callback body with
 *    its keys recursively sorted, using a separate IPN secret (not the API
 *    key), per NOWPayments' IPN documentation.
 *  - Crypto payments are irreversible on-chain, so there is no refund API;
 *    capabilities.supportsRefunds is false and refundPayment always throws.
 */
export class NowPaymentsPaymentProvider implements PaymentProvider {
  readonly key = "nowpayments";
  readonly label = "NOWPayments";
  readonly capabilities: PaymentProviderCapabilities = {
    supportsSubscriptions: false,
    supportsRefunds: false,
    supportsCustomers: false,
    supportsWebhooks: true,
  };

  constructor(
    private readonly apiKey: string,
    private readonly ipnSecret: string
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${NOWPAYMENTS_BASE_URL}${path}`, {
      ...init,
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const body = await res.json();
    if (!res.ok) {
      logger.error("nowpayments.request_failed", { path, status: res.status });
      throw new Error(body?.message ?? `NOWPayments request failed (${res.status})`);
    }
    return body as T;
  }

  async testConnection(): Promise<ProviderTestResult> {
    try {
      // GET /status is unauthenticated, so it can't validate the key.
      // Listing payments does require the key and has no side effects.
      await this.request("/payment/?limit=1");
      return { state: "CONNECTED", message: "Connected to NOWPayments.", checkedAt: new Date().toISOString() };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const lower = message.toLowerCase();
      const state = lower.includes("401") || lower.includes("invalid api key") || lower.includes("unauthorized")
        ? "AUTH_FAILED"
        : "ENDPOINT_ERROR";
      return { state, message, checkedAt: new Date().toISOString() };
    }
  }

  async createPayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const reference = `order_${input.orderId}_${Date.now()}`;
    const data = await this.request<NowPaymentsInvoiceResponse>("/invoice", {
      method: "POST",
      body: JSON.stringify({
        price_amount: input.amount,
        price_currency: input.currency,
        order_id: reference,
        order_description: `Order ${input.orderNumber}`,
        success_url: input.callbackUrl,
        cancel_url: input.callbackUrl,
      }),
    });
    return { authorizationUrl: data.invoice_url, providerReference: reference };
  }

  async verifyPayment(providerReference: string): Promise<VerifyPaymentResult> {
    const list = await this.request<{ data: NowPaymentsRecord[] }>(
      `/payment/?orderId=${encodeURIComponent(providerReference)}&limit=1&sortBy=created_at&orderBy=desc`
    );
    const record = list.data?.[0];
    if (!record) {
      return { providerReference, status: "PENDING", amount: 0, currency: "", paidAt: null, raw: list };
    }
    const isPaid = record.payment_status === "finished" || record.payment_status === "confirmed";
    const isFailed = record.payment_status === "failed" || record.payment_status === "expired";
    return {
      providerReference,
      status: isPaid ? "PAID" : isFailed ? "FAILED" : "PENDING",
      amount: record.actually_paid ?? record.price_amount,
      currency: record.price_currency,
      paidAt: isPaid ? new Date().toISOString() : null,
      raw: record,
    };
  }

  async getTransaction(providerReference: string): Promise<VerifyPaymentResult> {
    return this.verifyPayment(providerReference);
  }

  async refundPayment(_input: RefundInput): Promise<RefundResult> {
    throw new Error("NOWPayments does not support refunds: crypto payments are irreversible on-chain.");
  }

  private sortKeysRecursively(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sortKeysRecursively(item));
    if (value !== null && typeof value === "object") {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce((sorted: Record<string, unknown>, key) => {
          sorted[key] = this.sortKeysRecursively((value as Record<string, unknown>)[key]);
          return sorted;
        }, {});
    }
    return value;
  }

  verifyWebhookSignature(input: WebhookVerificationInput): boolean {
    try {
      const payload = JSON.parse(input.rawBody);
      const sorted = this.sortKeysRecursively(payload);
      const expected = crypto.createHmac("sha512", this.ipnSecret).update(JSON.stringify(sorted)).digest("hex");
      return input.signatureHeader === expected;
    } catch {
      return false;
    }
  }

  handleWebhook(rawBody: string) {
    const payload = JSON.parse(rawBody) as { payment_status?: string; order_id?: string };
    const isPaid = payload.payment_status === "finished" || payload.payment_status === "confirmed";
    return {
      type: isPaid ? "charge.success" : `payment.${payload.payment_status ?? "unknown"}`,
      providerReference: payload.order_id ?? "",
      raw: payload,
    };
  }
}
