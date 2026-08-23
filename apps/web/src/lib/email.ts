import { createEmailClient, type EmailClient } from "@cinerra/email";
import { env } from "./env";

// Constructing the Resend client is not network I/O (unlike the ioredis
// singleton in rateLimit.ts) — it just stores the API key — so it's safe
// to build eagerly at module scope, same as storage.ts's storageClient.
const globalForEmail = globalThis as unknown as { emailClient?: EmailClient };

export const emailClient = globalForEmail.emailClient ?? createEmailClient(env);

if (process.env.NODE_ENV !== "production") {
  globalForEmail.emailClient = emailClient;
}
