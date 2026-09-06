import { describe, expect, it } from "vitest";
import { MockDomainProvider } from "@/lib/providers/domain/mock";

describe("MockDomainProvider", () => {
  it("reports a domain as unavailable once registered through this instance", async () => {
    const provider = new MockDomainProvider();
    const domain = `test-${Date.now()}.com`;

    const availableBefore = await provider.checkAvailability(domain);
    expect(availableBefore).toBe(true);

    await provider.registerDomain({ domain, years: 1, customerEmail: "a@example.com", customerName: "A" });

    const availableAfter = await provider.checkAvailability(domain);
    expect(availableAfter).toBe(false);
  });

  it("getDomainDetails reflects what was actually registered, not fixed canned data", async () => {
    const provider = new MockDomainProvider();
    const domain = `details-${Date.now()}.com`;

    const result = await provider.registerDomain({ domain, years: 2, customerEmail: "a@example.com", customerName: "A", nameservers: ["ns1.custom.com", "ns2.custom.com"] });
    const details = await provider.getDomainDetails(domain);

    expect(details.status).toBe("ACTIVE");
    expect(details.expiresAt).toBe(result.expiresAt);
    expect(details.nameservers).toEqual(["ns1.custom.com", "ns2.custom.com"]);
  });

  it("getPricingQuote scales linearly with years and differs between register and renew", async () => {
    const provider = new MockDomainProvider();
    const oneYear = await provider.getPricingQuote("example.com", 1, "register");
    const threeYears = await provider.getPricingQuote("example.com", 3, "register");
    const renewal = await provider.getPricingQuote("example.com", 1, "renew");

    expect(threeYears.price).toBeCloseTo(oneYear.price * 3, 2);
    expect(renewal.price).not.toBe(oneYear.price);
  });

  it("renewDomain extends from a caller-supplied currentExpiresAt rather than only its own in-memory state", async () => {
    const provider = new MockDomainProvider();
    const farFutureExpiry = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString();

    // A fresh provider instance (as a separate worker process would have)
    // has no memory of this domain, but the caller (our database) does.
    const { expiresAt } = await provider.renewDomain("never-seen-before.com", 1, farFutureExpiry);

    const expectedYear = new Date(farFutureExpiry).getFullYear() + 1;
    expect(new Date(expiresAt).getFullYear()).toBe(expectedYear);
  });

  it("creates and deletes DNS records", async () => {
    const provider = new MockDomainProvider();
    const domain = `dns-${Date.now()}.com`;

    const { providerRecordId } = await provider.createDNSRecord({ domain, type: "A", name: "@", value: "203.0.113.10" });
    expect(providerRecordId).toBeTruthy();

    await expect(provider.deleteDNSRecord(domain, providerRecordId)).resolves.toBeUndefined();
  });
});
