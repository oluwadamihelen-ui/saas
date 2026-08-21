import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing via Node's built-in scrypt (no native module dependency
 * — bcrypt/argon2 native bindings are avoidable friction in containerized
 * deploys). scrypt is a memory-hard KDF and a well-accepted choice for
 * password storage.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, derivedHex] = storedHash.split(":");
  if (!salt || !derivedHex) return false;
  const derived = scryptSync(password, salt, 64);
  const stored = Buffer.from(derivedHex, "hex");
  if (derived.length !== stored.length) return false;
  return timingSafeEqual(derived, stored);
}
