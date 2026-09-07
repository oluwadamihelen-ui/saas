import crypto from "crypto";
import { ProviderTestResult } from "../types";
import {
  DNSRecordInput,
  DomainDetails,
  DomainProvider,
  DomainProviderCapabilities,
  DomainSearchResult,
  PricingQuote,
  RegisterDomainInput,
  RegisterDomainResult,
} from "./types";

const TLD_PRICING: Record<string, { register: number; renew: number }> = {
  com: { register: 12.99, renew: 14.99 },
  ng: { register: 18.0, renew: 18.0 },
  org: { register: 13.99, renew: 15.99 },
  net: { register: 13.49, renew: 15.49 },
  co: { register: 27.99, renew: 29.99 },
  io: { register: 44.99, renew: 49.99 },
  app: { register: 16.99, renew: 18.99 },
};
const DEFAULT_PRICING = { register: 15.99, renew: 17.99 };

function tldOf(domain: string): string {
  return domain.split(".").slice(1).join(".");
}

// Deterministic pseudo-availability so demos behave consistently for domains
// this mock has never "registered" -- once registered here, the in-memory
// state below takes over and always reports it as taken.
function isTaken(domain: string): boolean {
  const hash = crypto.createHash("md5").update(domain).digest("hex");
  return parseInt(hash.slice(0, 2), 16) % 3 === 0;
}

interface MockDomainRecord {
  status: DomainDetails["status"];
  expiresAt: string;
  nameservers: string[];
  autoRenew: boolean;
}

interface MockDnsRecord extends DNSRecordInput {
  providerRecordId: string;
}

/**
 * Unlike the earlier stateless version, this mock tracks what's actually
 * been "registered"/"created" through it (module-level Maps, same pattern
 * as MockPaymentProvider's transaction store) so getDomainDetails/DNS
 * listing/availability reflect reality across calls instead of always
 * returning fixed canned data.
 */
export class MockDomainProvider implements DomainProvider {
  readonly key = "mock";
  readonly label = "Mock Registrar (Demo Mode)";
  readonly capabilities: DomainProviderCapabilities = {
    search: true,
    register: true,
    renew: true,
    transfer: true,
    dnsManagement: true,
    nameserverUpdate: true,
  };

  private domains = new Map<string, MockDomainRecord>();
  private dnsRecords = new Map<string, MockDnsRecord[]>();

  async testConnection(): Promise<ProviderTestResult> {
    return { state: "CONNECTED", message: "Mock registrar always connects.", checkedAt: new Date().toISOString() };
  }

  async searchDomain(query: string, tlds: string[]): Promise<DomainSearchResult[]> {
    const clean = query.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    return tlds.map((tld) => {
      const domain = `${clean}.${tld}`;
      const pricing = TLD_PRICING[tld] ?? DEFAULT_PRICING;
      return {
        domain,
        tld,
        available: !this.domains.has(domain) && !isTaken(domain),
        registrationPrice: pricing.register,
        renewalPrice: pricing.renew,
        currency: "USD",
      };
    });
  }

  async checkAvailability(domain: string): Promise<boolean> {
    return !this.domains.has(domain) && !isTaken(domain);
  }

  async getPricingQuote(domain: string, years: number, action: "register" | "renew"): Promise<PricingQuote> {
    const pricing = TLD_PRICING[tldOf(domain)] ?? DEFAULT_PRICING;
    const perYear = action === "renew" ? pricing.renew : pricing.register;
    return { price: Math.round(perYear * years * 100) / 100, currency: "USD" };
  }

  async registerDomain(input: RegisterDomainInput): Promise<RegisterDomainResult> {
    const now = new Date();
    const expires = new Date(now);
    expires.setFullYear(expires.getFullYear() + input.years);
    const nameservers = input.nameservers ?? ["ns1.mockdns.com", "ns2.mockdns.com"];

    this.domains.set(input.domain, { status: "ACTIVE", expiresAt: expires.toISOString(), nameservers, autoRenew: true });

    return {
      providerRef: `mock_domain_${crypto.randomUUID()}`,
      registeredAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      nameservers,
    };
  }

  async renewDomain(domain: string, years: number, currentExpiresAt?: string): Promise<{ expiresAt: string }> {
    const existing = this.domains.get(domain);
    const knownExpiry = currentExpiresAt ?? existing?.expiresAt;
    const base = knownExpiry ? new Date(knownExpiry) : new Date();
    const expires = base > new Date() ? base : new Date();
    expires.setFullYear(expires.getFullYear() + years);

    this.domains.set(domain, {
      status: "ACTIVE",
      nameservers: existing?.nameservers ?? ["ns1.mockdns.com", "ns2.mockdns.com"],
      autoRenew: existing?.autoRenew ?? true,
      expiresAt: expires.toISOString(),
    });

    return { expiresAt: expires.toISOString() };
  }

  async transferDomain(domain: string, _authCode: string): Promise<{ providerRef: string; status: string }> {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    this.domains.set(domain, {
      status: "ACTIVE",
      expiresAt: expires.toISOString(),
      nameservers: ["ns1.mockdns.com", "ns2.mockdns.com"],
      autoRenew: true,
    });
    return { providerRef: `mock_transfer_${crypto.randomUUID()}`, status: "COMPLETED" };
  }

  async getDomainDetails(domain: string): Promise<DomainDetails> {
    const existing = this.domains.get(domain);
    if (existing) return { domain, ...existing };
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    return { domain, status: "ACTIVE", expiresAt: expires.toISOString(), nameservers: ["ns1.mockdns.com", "ns2.mockdns.com"], autoRenew: true };
  }

  async updateNameservers(domain: string, nameservers: string[]): Promise<void> {
    const existing = this.domains.get(domain);
    if (existing) existing.nameservers = nameservers;
  }

  async createDNSRecord(input: DNSRecordInput): Promise<{ providerRecordId: string }> {
    const providerRecordId = `mock_dns_${crypto.randomUUID()}`;
    const records = this.dnsRecords.get(input.domain) ?? [];
    records.push({ ...input, providerRecordId });
    this.dnsRecords.set(input.domain, records);
    return { providerRecordId };
  }

  async deleteDNSRecord(domain: string, providerRecordId: string): Promise<void> {
    const records = this.dnsRecords.get(domain);
    if (!records) return;
    this.dnsRecords.set(domain, records.filter((r) => r.providerRecordId !== providerRecordId));
  }
}
