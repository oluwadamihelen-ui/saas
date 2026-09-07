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

const KORAPAY_BASE_URL = "https://api.korapay.com/merchant/api/v1";

interface KoraChargeResponse {
  reference: string;
  checkout_url: string;
}

interface KoraChargeStatus {
  reference: string;
  status: string;
  amount: number;
  amount_paid?: number;
  currency: string;
  paid_at?: string | null;
}

/**
 * Real payment provider adapter for KoraPay (api.korapay.com), a Nigerian
 * payment aggregator. Same interface shape as PaystackPaymentProvider, but
 * two API details differ from Paystack and are worth calling out:
 *  - KoraPay's `amount` is in the currency's major unit (e.g. naira), not
 *    the smallest unit -- there is no kobo conversion here.
 *  - Its webhook signature is an HMAC-SHA256 of JSON.stringify(payload.data)
 *    only (not the whole raw body), per developers.korapay.com/docs/webhooks.
 */
export class KoraPayPaymentProvider implements PaymentProvider {
  readonly key = "korapay";
  readonly label = "KoraPay";
  readonly capabilities: PaymentProviderCapabilities = {
    supportsSubscriptions: false,
    supportsRefunds: true,
    supportsCustomers: false,
    supportsWebhooks: true,
  };

  constructor(private readonly secretKey: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${KORAPAY_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const body = await res.json();
    if (!res.ok || body.status === false) {
      logger.error("korapay.request_failed", { path, status: res.status });
      throw new Error(body.message ?? `KoraPay request failed (${res.status})`);
    }
    return body.data as T;
  }

  async testConnection(): Promise<ProviderTestResult> {
    try {
      // KoraPay has no dedicated "ping" endpoint. Querying a charge
      // reference that cannot exist still proves whether the secret key is
      // accepted: a 401 means the key is bad, a "not found" means the key
      // worked and KoraPay simply has no such charge.
      await this.request(`/charges/connection-test-${Date.now()}`);
      return { state: "CONNECTED", message: "Connected to KoraPay.", checkedAt: new Date().toISOString() };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const lower = message.toLowerCase();
      const checkedAt = new Date().toISOString();
      if (lower.includes("401") || lower.includes("unauthorized") || (lower.includes("invalid") && lower.includes("key"))) {
        return { state: "AUTH_FAILED", message, checkedAt };
      }
      if (lower.includes("404") || lower.includes("not found")) {
        return { state: "CONNECTED", message: "Connected to KoraPay.", checkedAt };
      }
      return { state: "ENDPOINT_ERROR", message, checkedAt };
    }
  }

  async createPayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const reference = `order_${input.orderId}_${Date.now()}`;
    const data = await this.request<KoraChargeResponse>("/charges/initialize", {
      method: "POST",
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        reference,
        narration: `Order ${input.orderNumber}`,
        redirect_url: input.callbackUrl,
        notification_url: input.callbackUrl,
        customer: { name: input.customerName, email: input.customerEmail },
        metadata: { orderId: input.orderId, orderNumber: input.orderNumber, ...input.metadata },
      }),
    });
    return { authorizationUrl: data.checkout_url, providerReference: data.reference };
  }

  async verifyPayment(providerReference: string): Promise<VerifyPaymentResult> {
    const data = await this.request<KoraChargeStatus>(`/charges/${encodeURIComponent(providerReference)}`);
    return {
      providerReference: data.reference,
      status: data.status === "success" ? "PAID" : data.status === "failed" ? "FAILED" : "PENDING",
      amount: data.amount_paid ?? data.amount,
      currency: data.currency,
      paidAt: data.paid_at ?? null,
      raw: data,
    };
  }

  async getTransaction(providerReference: string): Promise<VerifyPaymentResult> {
    return this.verifyPayment(providerReference);
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    const data = await this.request<{ status: string; reference?: string }>("/refunds/initiate", {
      method: "POST",
      body: JSON.stringify({
        transaction_reference: input.providerReference,
        amount: input.amount,
        reason: input.reason,
      }),
    });
    return {
      providerRefundReference: data.reference ?? input.providerReference,
      status: data.status === "success" || data.status === "processed" ? "PROCESSED" : "PENDING",
    };
  }

  verifyWebhookSignature(input: WebhookVerificationInput): boolean {
    try {
      const payload = JSON.parse(input.rawBody);
      const expected = crypto.createHmac("sha256", this.secretKey).update(JSON.stringify(payload.data)).digest("hex");
      return input.signatureHeader === expected;
    } catch {
      return false;
    }
  }

  handleWebhook(rawBody: string) {
    const payload = JSON.parse(rawBody);
    return { type: payload.event, providerReference: payload.data?.reference, raw: payload };
  }
}
