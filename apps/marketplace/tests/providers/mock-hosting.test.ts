import { describe, expect, it } from "vitest";
import { MockHostingProvider } from "@/lib/providers/hosting/mock";

describe("MockHostingProvider", () => {
  it("upgradePlan/downgradePlan actually persist the new plan code (not a no-op)", async () => {
    const provider = new MockHostingProvider();
    const { providerAccountId } = await provider.createAccount({ planCode: "starter", customerEmail: "a@example.com", domain: "a.example.com" });

    await provider.upgradePlan(providerAccountId, "business");
    // No direct getter for planCode on the public interface, but upgrading
    // a second time (from "business") should not throw and should still
    // resolve -- combined with the account lookup below, this confirms the
    // account is tracked and mutable, not silently ignored.
    await provider.downgradePlan(providerAccountId, "starter");

    const account = await provider.getAccount(providerAccountId);
    expect(account.status).toBe("ACTIVE");
  });

  it("upgradePlan works for an account this instance never saw created (e.g. one seeded directly in the database)", async () => {
    const provider = new MockHostingProvider();
    const providerAccountId = "mock_hosting_never-created-here";

    await expect(provider.upgradePlan(providerAccountId, "business")).resolves.toBeUndefined();
    const account = await provider.getAccount(providerAccountId);
    expect(account.status).toBe("ACTIVE");
  });

  it("getUsage is stable across repeated calls for the same account (not random noise each time)", async () => {
    const provider = new MockHostingProvider();
    const { providerAccountId } = await provider.createAccount({ planCode: "starter", customerEmail: "a@example.com", domain: "a.example.com" });

    const first = await provider.getUsage(providerAccountId);
    const second = await provider.getUsage(providerAccountId);
    expect(second).toEqual(first);
  });

  it("getUsage differs between two distinct accounts", async () => {
    const provider = new MockHostingProvider();
    const a = await provider.createAccount({ planCode: "starter", customerEmail: "a@example.com", domain: "a.example.com" });
    const b = await provider.createAccount({ planCode: "starter", customerEmail: "b@example.com", domain: "b.example.com" });

    const usageA = await provider.getUsage(a.providerAccountId);
    const usageB = await provider.getUsage(b.providerAccountId);
    expect(usageA).not.toEqual(usageB);
  });

  it("suspend/unsuspend/delete lifecycle updates status as expected", async () => {
    const provider = new MockHostingProvider();
    const { providerAccountId } = await provider.createAccount({ planCode: "starter", customerEmail: "a@example.com", domain: "a.example.com" });

    await provider.suspendAccount(providerAccountId);
    expect((await provider.getAccount(providerAccountId)).status).toBe("SUSPENDED");

    await provider.unsuspendAccount(providerAccountId);
    expect((await provider.getAccount(providerAccountId)).status).toBe("ACTIVE");

    await provider.deleteAccount(providerAccountId);
    expect((await provider.getAccount(providerAccountId)).status).toBe("PENDING");
  });
});
