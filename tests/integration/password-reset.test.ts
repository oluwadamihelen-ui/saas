import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requestPasswordReset, resetPassword } from "@/lib/services/password-reset";
import { MockEmailProvider } from "@/lib/providers/email/mock";

const SUFFIX = `pwreset-${Date.now()}`;

describe("password reset flow", () => {
  let userId: string;
  let email: string;

  beforeAll(async () => {
    const role = await prisma.role.upsert({ where: { key: "CUSTOMER" }, update: {}, create: { key: "CUSTOMER", name: "Customer" } });
    email = `${SUFFIX}@example.com`;
    const user = await prisma.user.create({
      data: { name: "Reset Test User", email, passwordHash: await bcrypt.hash("OldPassw0rd!", 12), roleId: role.id, status: "ACTIVE" },
    });
    userId = user.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (!userId) return;
    await prisma.passwordResetToken.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({ where: { actorId: userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it("creates a token and emails a reset link for a real, active account", async () => {
    const sendSpy = vi.spyOn(MockEmailProvider.prototype, "send");

    await requestPasswordReset(email, "http://localhost:3000");

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const sentTo = sendSpy.mock.calls[0][0];
    expect(sentTo.to).toBe(email);
    expect(sentTo.html).toContain("http://localhost:3000/reset-password?token=");

    const tokenCount = await prisma.passwordResetToken.count({ where: { userId } });
    expect(tokenCount).toBe(1);
  });

  it("does nothing (no token, no email) for an email that doesn't match any account", async () => {
    const sendSpy = vi.spyOn(MockEmailProvider.prototype, "send");
    await requestPasswordReset(`nobody-${SUFFIX}@example.com`, "http://localhost:3000");
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("resets the password with a valid token and lets the user log in with the new password", async () => {
    const sendSpy = vi.spyOn(MockEmailProvider.prototype, "send");
    await requestPasswordReset(email, "http://localhost:3000");
    const link = sendSpy.mock.calls[0][0].html;
    const token = new URL(link.match(/href="([^"]+)"/)![1]).searchParams.get("token")!;

    await resetPassword(token, "BrandNewPassw0rd!");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await bcrypt.compare("BrandNewPassw0rd!", user.passwordHash!)).toBe(true);
    expect(await bcrypt.compare("OldPassw0rd!", user.passwordHash!)).toBe(false);
  });

  it("rejects a token that's already been used", async () => {
    const sendSpy = vi.spyOn(MockEmailProvider.prototype, "send");
    await requestPasswordReset(email, "http://localhost:3000");
    const link = sendSpy.mock.calls[0][0].html;
    const token = new URL(link.match(/href="([^"]+)"/)![1]).searchParams.get("token")!;

    await resetPassword(token, "FirstUsePassw0rd!");
    await expect(resetPassword(token, "SecondUsePassw0rd!")).rejects.toThrow(/invalid or has expired/i);
  });

  it("rejects an unknown/garbage token", async () => {
    await expect(resetPassword("not-a-real-token", "Whatever12345!")).rejects.toThrow(/invalid or has expired/i);
  });

  it("invalidates other outstanding tokens for the same user once one is used", async () => {
    vi.spyOn(MockEmailProvider.prototype, "send");
    await requestPasswordReset(email, "http://localhost:3000");
    await requestPasswordReset(email, "http://localhost:3000");

    const tokens = await prisma.passwordResetToken.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    expect(tokens.length).toBeGreaterThanOrEqual(2);
    const [, second] = tokens.slice(-2);

    // We don't have the raw token for `second` (only its hash is stored),
    // so use the raw token captured from the most recent send() call instead.
    const sendSpy = MockEmailProvider.prototype.send as unknown as ReturnType<typeof vi.fn>;
    const lastLink = sendSpy.mock.calls[sendSpy.mock.calls.length - 1][0].html;
    const lastToken = new URL(lastLink.match(/href="([^"]+)"/)![1]).searchParams.get("token")!;

    await resetPassword(lastToken, "FinalPassw0rd!");

    const refreshed = await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: second.id } });
    expect(refreshed.usedAt).not.toBeNull();
  });
});
