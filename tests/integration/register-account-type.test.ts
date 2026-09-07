import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { registerCustomer } from "@/app/(auth)/register/actions";

const SUFFIX = `register-${Date.now()}`;
const createdEmails: string[] = [];

function buildFormData(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

describe("registerCustomer: account type selection", () => {
  afterAll(async () => {
    if (createdEmails.length === 0) return;
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  });

  it("creates a CUSTOMER account when accountType is omitted (default)", async () => {
    const email = `buyer-default-${SUFFIX}@example.com`;
    createdEmails.push(email);

    const result = await registerCustomer(
      { status: "idle" },
      buildFormData({ name: "Buyer Default", email, password: "Passw0rd!" })
    );

    expect(result.status).toBe("success");
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { role: true } });
    expect(user.role.key).toBe("CUSTOMER");
  });

  it("creates a CUSTOMER account when accountType=CUSTOMER is chosen explicitly", async () => {
    const email = `buyer-explicit-${SUFFIX}@example.com`;
    createdEmails.push(email);

    const result = await registerCustomer(
      { status: "idle" },
      buildFormData({ name: "Buyer Explicit", email, password: "Passw0rd!", accountType: "CUSTOMER" })
    );

    expect(result.status).toBe("success");
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { role: true } });
    expect(user.role.key).toBe("CUSTOMER");
  });

  it("creates a DEVELOPER account when accountType=DEVELOPER is chosen", async () => {
    const email = `dev-${SUFFIX}@example.com`;
    createdEmails.push(email);

    const result = await registerCustomer(
      { status: "idle" },
      buildFormData({ name: "New Developer", email, password: "Passw0rd!", accountType: "DEVELOPER" })
    );

    expect(result.status).toBe("success");
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { role: true } });
    expect(user.role.key).toBe("DEVELOPER");
  });

  it("rejects duplicate emails regardless of account type", async () => {
    const email = `dupe-${SUFFIX}@example.com`;
    createdEmails.push(email);

    const first = await registerCustomer({ status: "idle" }, buildFormData({ name: "First", email, password: "Passw0rd!" }));
    expect(first.status).toBe("success");

    const second = await registerCustomer(
      { status: "idle" },
      buildFormData({ name: "Second", email, password: "Passw0rd!", accountType: "DEVELOPER" })
    );
    expect(second.status).toBe("error");

    const count = await prisma.user.count({ where: { email } });
    expect(count).toBe(1);
  });
});
