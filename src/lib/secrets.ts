import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * AES-256-GCM for small secrets (payout details). Key: APP_ENCRYPTION_KEY (base64, 32 bytes).
 * In development only, falls back to a key derived from AUTH_SECRET.
 */
function key(): Buffer {
  const k = process.env.APP_ENCRYPTION_KEY;
  if (k) {
    const b = Buffer.from(k, "base64");
    if (b.length !== 32) throw new Error("APP_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)");
    return b;
  }
  if (process.env.NODE_ENV === "production") throw new Error("APP_ENCRYPTION_KEY is required in production");
  return createHash("sha256").update(`dev:${process.env.AUTH_SECRET ?? "riskpilot-dev"}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(token: string): string {
  const [v, iv, tag, data] = token.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Invalid secret");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

/** Safe hint for display: the last 4 digits of the longest digit run (account number), never any letters. */
export function hintOf(plain: string): string {
  const runs = plain.replace(/[\s-]/g, "").match(/\d{6,}/g);
  const longest = runs?.sort((a, b) => b.length - a.length)[0];
  return longest ? `••••${longest.slice(-4)}` : "••••";
}
