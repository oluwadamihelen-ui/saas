export interface EmailCredentials {
  apiKey: string;
  fromEmail: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

export interface SendEmailResult {
  status: "sent" | "failed";
  error?: string;
}

/// Every real email provider implements this same shape, so adding one is
/// a new file + a registry entry — never a change to notifyRecipients.
export interface EmailProvider {
  name: string;
  send(input: SendEmailInput, credentials: EmailCredentials): Promise<SendEmailResult>;
}

export interface SmsCredentials {
  apiKey: string;
  fromIdentifier: string;
  /// Twilio-only: paired with apiKey (which holds the Auth Token for
  /// Twilio) to authenticate. Undefined for every other SMS provider.
  accountSid?: string;
}

export interface SendSmsInput {
  to: string;
  body: string;
}

export interface SendSmsResult {
  status: "sent" | "failed";
  error?: string;
}

export interface SmsProvider {
  name: string;
  send(input: SendSmsInput, credentials: SmsCredentials): Promise<SendSmsResult>;
}
