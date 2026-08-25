import { Resend } from "resend";
import type { Env } from "@cinerra/config";

export * from "./templates.js";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailClient {
  readonly configured: boolean;
  send(params: SendEmailParams): Promise<void>;
}

class ResendEmailClient implements EmailClient {
  readonly configured = true;
  private readonly resend: Resend;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.resend = new Resend(apiKey);
    this.from = from;
  }

  async send(params: SendEmailParams): Promise<void> {
    const result = await this.resend.emails.send({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (result.error) {
      throw new Error(`Resend rejected the email: ${result.error.message}`);
    }
  }
}

/**
 * Honest degrade (spec §81) — email is a side effect of another action
 * (signup, an export finishing), never the primary thing that action is
 * for, so an unconfigured provider must never make signup/export fail.
 * This logs what would have been sent instead of pretending to send it.
 */
class NoopEmailClient implements EmailClient {
  readonly configured = false;

  async send(params: SendEmailParams): Promise<void> {
    console.log(`[email] Not configured (RESEND_API_KEY unset) — would have sent "${params.subject}" to ${params.to}.`);
  }
}

export function createEmailClient(env: Env): EmailClient {
  if (!env.RESEND_API_KEY) return new NoopEmailClient();
  return new ResendEmailClient(env.RESEND_API_KEY, env.EMAIL_FROM ?? "FilmDoe <onboarding@resend.dev>");
}
