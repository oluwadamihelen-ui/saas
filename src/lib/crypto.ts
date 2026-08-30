import crypto from "crypto";

/**
 * Lightweight at-rest encryption for merchant-supplied secrets (WhatsApp
 * access tokens, Paystack secret keys) using AES-256-GCM with a key derived
 * from AUTH_SECRET. This keeps secrets out of plaintext in the database;
 * in production this key should come from a dedicated secrets manager/KMS
 * rather than reusing the session secret.
 */
function getKey() {
  const secret = process.env.AUTH_SECRET ?? "insecure-dev-secret";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(".");
}

export function decryptSecret(payload: string): string | null {
  try {
    const [ivHex, tagHex, dataHex] = payload.split(".");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
