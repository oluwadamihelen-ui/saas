import crypto from "crypto";
import { logger } from "@/lib/security/logger";
import { ProviderTestResult } from "../types";
import { EmailProvider, SendEmailInput } from "./types";

/**
 * Logs outbound email instead of sending it, so the full notification
 * pipeline (order confirmations, deployment updates, etc.) can be developed
 * and tested without an email provider configured.
 */
export class MockEmailProvider implements EmailProvider {
  readonly key = "mock";
  readonly label = "Mock Email (Demo Mode)";

  async testConnection(): Promise<ProviderTestResult> {
    return { state: "CONNECTED", message: "Mock email provider always connects.", checkedAt: new Date().toISOString() };
  }

  async send(input: SendEmailInput): Promise<{ providerMessageId: string }> {
    logger.info("email.mock_send", { to: input.to, subject: input.subject });
    return { providerMessageId: `mock_email_${crypto.randomUUID()}` };
  }
}
