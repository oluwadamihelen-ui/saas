import { ProviderAdapterBase } from "../types";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider extends ProviderAdapterBase {
  send(input: SendEmailInput): Promise<{ providerMessageId: string }>;
}
