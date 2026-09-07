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
  /**
   * WHOIS registrant contact -- required by real registrars (ICANN policy),
   * unused by the mock. Optional here so the interface stays backward
   * compatible; an adapter that needs them (see
   * DomainProviderCapabilities.requiresRegistrantContact) throws a clear
   * error if they're missing rather than silently registering with bad data.
   */
  registrantAddress1?: string;
  registrantCity?: string;
  registrantStateProvince?: string;
  registrantPostalCode?: string;
  registrantCountry?: string;
  registrantPhone?: string;
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
  /** True for any real registrar -- ICANN requires a full WHOIS registrant contact on file. */
  requiresRegistrantContact: boolean;
}

export interface PricingQuote {
  price: number;
  currency: string;
}

export interface DomainProvider extends ProviderAdapterBase {
  readonly capabilities: DomainProviderCapabilities;
  searchDomain(query: string, tlds: string[]): Promise<DomainSearchResult[]>;
  checkAvailability(domain: string): Promise<boolean>;
  /** Quote for one registration/renewal action, in the provider's currency. */
  getPricingQuote(domain: string, years: number, action: "register" | "renew"): Promise<PricingQuote>;
  registerDomain(input: RegisterDomainInput): Promise<RegisterDomainResult>;
  /**
   * `currentExpiresAt` is the caller's own record of the domain's current
   * expiry (from our database, the source of truth for "when does this
   * expire") -- a real registrar wouldn't need this since it tracks expiry
   * itself, but passing it lets the mock extend from the right date even
   * when called from a different process than the one that registered the
   * domain (the mock's in-memory state is per-process, not shared).
   */
  renewDomain(domain: string, years: number, currentExpiresAt?: string): Promise<{ expiresAt: string }>;
  transferDomain(domain: string, authCode: string): Promise<{ providerRef: string; status: string }>;
  getDomainDetails(domain: string): Promise<DomainDetails>;
  updateNameservers(domain: string, nameservers: string[]): Promise<void>;
  createDNSRecord(input: DNSRecordInput): Promise<{ providerRecordId: string }>;
  deleteDNSRecord(domain: string, providerRecordId: string): Promise<void>;
}
