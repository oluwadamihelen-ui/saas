import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("verifies a correct password against its hash", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(verifyPassword("wrong password", hash)).toBe(false);
  });

  it("produces a different hash (different salt) for the same password each time", () => {
    expect(hashPassword("same-password")).not.toBe(hashPassword("same-password"));
  });

  it("rejects a malformed stored hash instead of throwing", () => {
    expect(verifyPassword("anything", "not-a-real-hash")).toBe(false);
  });
});
