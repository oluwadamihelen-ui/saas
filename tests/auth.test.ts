import { describe, it, expect, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { POST as register } from "@/app/api/auth/register/route";

describe("password hashing", () => {
  it("hashes and verifies a password without storing it in plaintext", async () => {
    const hash = await bcrypt.hash("Sup3rSecret!", 12);
    expect(hash).not.toBe("Sup3rSecret!");
    expect(await bcrypt.compare("Sup3rSecret!", hash)).toBe(true);
    expect(await bcrypt.compare("wrong-password", hash)).toBe(false);
  });
});

describe("POST /api/auth/register", () => {
  const email = `register-test-${Date.now()}@test.mama.dev`;

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("creates a new user with a hashed password", async () => {
    const res = await register(makeRequest({ name: "New Merchant", email, password: "StrongPass123" }));
    expect(res.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user?.passwordHash).not.toBe("StrongPass123");
  });

  it("rejects a duplicate email", async () => {
    const res = await register(makeRequest({ name: "Duplicate", email, password: "StrongPass123" }));
    expect(res.status).toBe(409);
  });

  it("rejects a weak/short password", async () => {
    const res = await register(makeRequest({ name: "Weak", email: `weak-${Date.now()}@test.mama.dev`, password: "short" }));
    expect(res.status).toBe(400);
  });
});
