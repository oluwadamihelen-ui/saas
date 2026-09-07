import { logger } from "@/lib/security/logger";
import { ProviderTestResult } from "../types";
import { EmailProvider, SendEmailInput } from "./types";

const RESEND_BASE_URL = "https://api.resend.com";

/**
 * Real email provider adapter (Resend's HTTP API), chosen as the V1
 * implemented email provider for the same reason Paystack was chosen for
 * payments: a single API key, a plain REST call, no SDK required. All other
 * providers ship as mocks until there's a real account to test against.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly key = "resend";
  readonly label = "Resend";

  constructor(
    private readonly apiKey: string,
    private readonly fromAddress: string = "BridgeCodes <notifications@bridgecodes.example>"
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${RESEND_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const body = await res.json();
    if (!res.ok) {
      logger.error("resend.request_failed", { path, status: res.status });
      throw new Error(body?.message ?? `Resend request failed (${res.status})`);
    }
    return body as T;
  }

  async testConnection(): Promise<ProviderTestResult> {
    try {
      // Resend has no dedicated "ping" endpoint -- listing API keys is the
      // lightest authenticated call available and has no side effects.
      await this.request("/api-keys");
      return { state: "CONNECTED", message: "Connected to Resend.", checkedAt: new Date().toISOString() };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const state = message.includes("401") || message.toLowerCase().includes("invalid") ? "AUTH_FAILED" : "ENDPOINT_ERROR";
      return { state, message, checkedAt: new Date().toISOString() };
    }
  }

  async send(input: SendEmailInput): Promise<{ providerMessageId: string }> {
    const data = await this.request<{ id: string }>("/emails", {
      method: "POST",
      body: JSON.stringify({
        from: this.fromAddress,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    return { providerMessageId: data.id };
  }
}
