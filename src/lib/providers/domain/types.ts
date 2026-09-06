import { ProviderAdapterBase } from "../types";

export interface DomainSearchResult {
  domain: string;
  tld: string;
  available: boolean;
  registrationPrice: number;
  renewalPrice: number;
  currency: string;
}

export interface RegisterDomainInput {
  domain: string;
  years: number;
  customerEmail: string;
  customerName: string;
  nameservers?: string[];
}

export interface RegisterDomainResult {
  providerRef: string;
  registeredAt: string;
  expiresAt: string;
  nameservers: string[];
}

export interface DomainDetails {
  domain: string;
  status: "ACTIVE" | "EXPIRED" | "PENDING" | "TRANSFERRED";
  expiresAt: string;
  nameservers: string[];
  autoRenew: boolean;
}

export interface DNSRecordInput {
  domain: string;
  type: "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS" | "SRV";
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
}

/**
 * Not every registrar supports every operation (e.g. some don't expose
 * transfer or DNS management via API). Adapters declare what they support so
 * calling code can degrade gracefully instead of assuming feature parity.
 */
export interface DomainProviderCapabilities {
  search: boolean;
  register: boolean;
  renew: boolean;
  transfer: boolean;
  dnsManagement: boolean;
  nameserverUpdate: boolean;
}

export interface DomainProvider extends ProviderAdapterBase {
  readonly capabilities: DomainProviderCapabilities;
  searchDomain(query: string, tlds: string[]): Promise<DomainSearchResult[]>;
  checkAvailability(domain: string): Promise<boolean>;
  registerDomain(input: RegisterDomainInput): Promise<RegisterDomainResult>;
  renewDomain(domain: string, years: number): Promise<{ expiresAt: string }>;
  transferDomain(domain: string, authCode: string): Promise<{ providerRef: string; status: string }>;
  getDomainDetails(domain: string): Promise<DomainDetails>;
  updateNameservers(domain: string, nameservers: string[]): Promise<void>;
  createDNSRecord(input: DNSRecordInput): Promise<{ providerRecordId: string }>;
  deleteDNSRecord(domain: string, providerRecordId: string): Promise<void>;
}
