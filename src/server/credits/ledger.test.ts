import { describe, it, expect, afterEach } from "vitest";
import { applyCreditDelta, getCreditBalance, InsufficientCreditsError } from "./ledger";
import { createTestUser, deleteTestUser } from "@/test/db-helpers";
import { prisma } from "@/server/db/client";

describe("applyCreditDelta", () => {
  let userId: string | undefined;

  afterEach(async () => {
    if (userId) await deleteTestUser(userId);
    userId = undefined;
  });

  it("starts a new user at zero and grants credits correctly", async () => {
    const user = await createTestUser("ledger");
    userId = user.id;

    expect(await getCreditBalance(user.id)).toBe(0);

    const after = await applyCreditDelta(user.id, 100, "SIGNUP_GRANT");
    expect(after).toBe(100);
    expect(await getCreditBalance(user.id)).toBe(100);
  });

  it("debits credits and records the correct balanceAfter", async () => {
    const user = await createTestUser("ledger");
    userId = user.id;

    await applyCreditDelta(user.id, 100, "SIGNUP_GRANT");
    const after = await applyCreditDelta(user.id, -30, "STORYBOARD_GENERATION");

    expect(after).toBe(70);
    expect(await getCreditBalance(user.id)).toBe(70);
  });

  it("throws InsufficientCreditsError and leaves the balance unchanged when a debit would go negative", async () => {
    const user = await createTestUser("ledger");
    userId = user.id;

    await applyCreditDelta(user.id, 10, "SIGNUP_GRANT");

    await expect(applyCreditDelta(user.id, -50, "STORYBOARD_GENERATION")).rejects.toBeInstanceOf(
      InsufficientCreditsError
    );

    expect(await getCreditBalance(user.id)).toBe(10);
  });

  it("does not write a ledger entry when the debit is rejected", async () => {
    const user = await createTestUser("ledger");
    userId = user.id;

    await applyCreditDelta(user.id, 5, "SIGNUP_GRANT");
    await expect(applyCreditDelta(user.id, -100, "STORYBOARD_GENERATION")).rejects.toThrow();

    const entries = await prisma.creditLedgerEntry.findMany({ where: { userId: user.id } });
    expect(entries).toHaveLength(1); // only the initial grant
  });

  it("records an auditable ledger entry for every successful delta", async () => {
    const user = await createTestUser("ledger");
    userId = user.id;

    await applyCreditDelta(user.id, 50, "SIGNUP_GRANT", { note: "welcome" });
    await applyCreditDelta(user.id, -20, "IMAGE_GENERATION", { projectId: "abc" });

    const entries = await prisma.creditLedgerEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    expect(entries).toHaveLength(2);
    expect(entries[0].amount).toBe(50);
    expect(entries[0].balanceAfter).toBe(50);
    expect(entries[1].amount).toBe(-20);
    expect(entries[1].balanceAfter).toBe(30);
  });

  it("allows a debit that exactly zeroes the balance", async () => {
    const user = await createTestUser("ledger");
    userId = user.id;

    await applyCreditDelta(user.id, 25, "SIGNUP_GRANT");
    const after = await applyCreditDelta(user.id, -25, "STORYBOARD_GENERATION");

    expect(after).toBe(0);
  });

  it("returns 0 for a user with no CreditBalance row yet", async () => {
    const user = await createTestUser("ledger");
    userId = user.id;
    expect(await getCreditBalance(user.id)).toBe(0);
  });
});
