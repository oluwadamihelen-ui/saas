import crypto from "crypto";
import { logger } from "@/lib/security/logger";
import { ProviderTestResult } from "../types";
import {
  CancelSubscriptionResult,
  CreateCustomerInput,
  CreateCustomerResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentProvider,
  PaymentProviderCapabilities,
  RefundInput,
  RefundResult,
  VerifyPaymentResult,
  WebhookVerificationInput,
} from "./types";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

/**
 * Real payment provider adapter, chosen as the V1 implemented provider
 * because it natively supports NGN and international cards, matching the
 * spec's Nigerian-market examples. All other providers ship as mocks.
 */
export class PaystackPaymentProvider implements PaymentProvider {
  readonly key = "paystack";
  readonly label = "Paystack";
  readonly capabilities: PaymentProviderCapabilities = {
    supportsSubscriptions: true,
    supportsRefunds: true,
    supportsCustomers: true,
    supportsWebhooks: true,
  };

  constructor(private readonly secretKey: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const body = await res.json();
    if (!res.ok || body.status === false) {
      logger.error("paystack.request_failed", { path, status: res.status });
      throw new Error(body.message ?? `Paystack request failed (${res.status})`);
    }
    return body.data as T;
  }

  async testConnection(): Promise<ProviderTestResult> {
    try {
      await this.request("/transaction/totals");
      return { state: "CONNECTED", message: "Connected to Paystack.", checkedAt: new Date().toISOString() };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const state = message.includes("401") || message.toLowerCase().includes("invalid key")
        ? "AUTH_FAILED"
        : "ENDPOINT_ERROR";
      return { state, message, checkedAt: new Date().toISOString() };
    }
  }

  async createPayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const data = await this.request<{ authorization_url: string; reference: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: input.customerEmail,
        amount: Math.round(input.amount * 100), // kobo/cents
        currency: input.currency,
        reference: `order_${input.orderId}_${Date.now()}`,
        callback_url: input.callbackUrl,
        metadata: { orderId: input.orderId, orderNumber: input.orderNumber, ...input.metadata },
      }),
    });
    return { authorizationUrl: data.authorization_url, providerReference: data.reference };
  }

  async verifyPayment(providerReference: string): Promise<VerifyPaymentResult> {
    const data = await this.request<{
      status: string;
      amount: number;
      currency: string;
      paid_at: string | null;
      reference: string;
    }>(`/transaction/verify/${encodeURIComponent(providerReference)}`);
    return {
      providerReference: data.reference,
      status: data.status === "success" ? "PAID" : data.status === "abandoned" ? "PENDING" : "FAILED",
      amount: data.amount / 100,
      currency: data.currency,
      paidAt: data.paid_at,
      raw: data,
    };
  }

  async getTransaction(providerReference: string): Promise<VerifyPaymentResult> {
    return this.verifyPayment(providerReference);
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    const data = await this.request<{ status: string }>("/refund", {
      method: "POST",
      body: JSON.stringify({ transaction: input.providerReference, amount: Math.round(input.amount * 100) }),
    });
    return {
      providerRefundReference: input.providerReference,
      status: data.status === "processed" ? "PROCESSED" : "PENDING",
    };
  }

  verifyWebhookSignature(input: WebhookVerificationInput): boolean {
    const expected = crypto.createHmac("sha512", this.secretKey).update(input.rawBody).digest("hex");
    return input.signatureHeader === expected;
  }

  handleWebhook(rawBody: string) {
    const payload = JSON.parse(rawBody);
    return { type: payload.event, providerReference: payload.data?.reference, raw: payload };
  }

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    const [firstName, ...rest] = input.name.split(" ");
    const data = await this.request<{ customer_code: string }>("/customer", {
      method: "POST",
      body: JSON.stringify({ email: input.email, first_name: firstName, last_name: rest.join(" ") || firstName }),
    });
    return { providerCustomerId: data.customer_code };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const data = await this.request<{
      subscription_code: string;
      status: string;
      next_payment_date: string;
    }>("/subscription", {
      method: "POST",
      body: JSON.stringify({ customer: input.providerCustomerId, plan: input.planReference }),
    });
    const now = new Date().toISOString();
    return {
      providerSubscriptionId: data.subscription_code,
      status: data.status === "active" ? "ACTIVE" : "TRIAL",
      currentPeriodStart: now,
      currentPeriodEnd: data.next_payment_date ?? now,
    };
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<CancelSubscriptionResult> {
    await this.request("/subscription/disable", {
      method: "POST",
      body: JSON.stringify({ code: providerSubscriptionId, token: providerSubscriptionId }),
    });
    return { status: "CANCELLED", cancelledAt: new Date().toISOString() };
  }
}
