import crypto from "crypto";
import { ProviderTestResult } from "../types";
import {
  DNSRecordInput,
  DomainDetails,
  DomainProvider,
  DomainProviderCapabilities,
  DomainSearchResult,
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

// Deterministic pseudo-availability so demos behave consistently.
function isTaken(domain: string): boolean {
  const hash = crypto.createHash("md5").update(domain).digest("hex");
  return parseInt(hash.slice(0, 2), 16) % 3 === 0;
}

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

  async testConnection(): Promise<ProviderTestResult> {
    return { state: "CONNECTED", message: "Mock registrar always connects.", checkedAt: new Date().toISOString() };
  }

  async searchDomain(query: string, tlds: string[]): Promise<DomainSearchResult[]> {
    const clean = query.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    return tlds.map((tld) => {
      const domain = `${clean}.${tld}`;
      const pricing = TLD_PRICING[tld] ?? { register: 15.99, renew: 17.99 };
      return {
        domain,
        tld,
        available: !isTaken(domain),
        registrationPrice: pricing.register,
        renewalPrice: pricing.renew,
        currency: "USD",
      };
    });
  }

  async checkAvailability(domain: string): Promise<boolean> {
    return !isTaken(domain);
  }

  async registerDomain(input: RegisterDomainInput): Promise<RegisterDomainResult> {
    const now = new Date();
    const expires = new Date(now);
    expires.setFullYear(expires.getFullYear() + input.years);
    return {
      providerRef: `mock_domain_${crypto.randomUUID()}`,
      registeredAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      nameservers: input.nameservers ?? ["ns1.mockdns.com", "ns2.mockdns.com"],
    };
  }

  async renewDomain(_domain: string, years: number): Promise<{ expiresAt: string }> {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + years);
    return { expiresAt: expires.toISOString() };
  }

  async transferDomain(_domain: string, _authCode: string): Promise<{ providerRef: string; status: string }> {
    return { providerRef: `mock_transfer_${crypto.randomUUID()}`, status: "PENDING" };
  }

  async getDomainDetails(domain: string): Promise<DomainDetails> {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    return { domain, status: "ACTIVE", expiresAt: expires.toISOString(), nameservers: ["ns1.mockdns.com", "ns2.mockdns.com"], autoRenew: true };
  }

  async updateNameservers(): Promise<void> {
    return;
  }

  async createDNSRecord(_input: DNSRecordInput): Promise<{ providerRecordId: string }> {
    return { providerRecordId: `mock_dns_${crypto.randomUUID()}` };
  }

  async deleteDNSRecord(): Promise<void> {
    return;
  }
}
