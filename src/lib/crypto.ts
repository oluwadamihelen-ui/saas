import "server-only";
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

/// Derives a 32-byte AES key from PAYMENT_KEYS_SECRET (falling back to
/// AUTH_SECRET, since every deployment already sets that one) rather than
/// requiring a raw 32-byte key in .env — a passphrase of any length hashes
/// down to the right size.
function getKey(): Buffer {
  const secret = process.env.PAYMENT_KEYS_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "PAYMENT_KEYS_SECRET (or AUTH_SECRET) must be set to store payment gateway credentials — see .env.example."
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

/// Encrypts a gateway secret key for storage — never store one in plain
/// text. Format is "iv:authTag:ciphertext", all hex, so it round-trips as
/// a single string column with no extra schema.
export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(cipherText: string): string {
  const [ivHex, authTagHex, dataHex] = cipherText.split(":");
  if (!ivHex || !authTagHex || !dataHex) throw new Error("Malformed encrypted payment credential.");

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

/// For display only, in the settings UI's "connected" state — shows just
/// enough of a secret to recognize it without ever re-exposing the whole
/// key, the same convention Stripe/Paystack's own dashboards use.
export function maskSecret(plainText: string): string {
  const tail = plainText.slice(-4);
  return `••••••••${tail}`;
}
