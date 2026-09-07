import { describe, expect, it, beforeAll } from "vitest";
import { decryptSecret, encryptSecret, redactSensitive } from "@/lib/security/encryption";

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("credential encryption", () => {
  it("round-trips a secret through encrypt/decrypt", () => {
    const plaintext = "sk_live_super_secret_value";
    const ciphertext = encryptSecret(plaintext);
    expect(ciphertext).not.toContain(plaintext);
    expect(decryptSecret(ciphertext)).toBe(plaintext);
  });

  it("fails to decrypt a tampered ciphertext", () => {
    const ciphertext = encryptSecret("another-secret");
    const [iv, tag, data] = ciphertext.split(".");
    const tampered = [iv, tag, Buffer.from("tampered").toString("base64")].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
    void data;
  });
});

describe("redactSensitive", () => {
  it("redacts keys that look like secrets before logging", () => {
    const redacted = redactSensitive({
      username: "sarah",
      password: "hunter2",
      apiKey: "abc123",
      nested: { sshPrivateKey: "-----BEGIN KEY-----", note: "safe to log" },
    }) as Record<string, unknown>;

    expect(redacted.username).toBe("sarah");
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.apiKey).toBe("[REDACTED]");
    expect((redacted.nested as Record<string, unknown>).sshPrivateKey).toBe("[REDACTED]");
    expect((redacted.nested as Record<string, unknown>).note).toBe("safe to log");
  });
});
