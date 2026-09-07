import { XMLParser } from "fast-xml-parser";
import { logger } from "@/lib/security/logger";
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

const PRODUCTION_BASE_URL = "https://api.namecheap.com/xml.response";
const SANDBOX_BASE_URL = "https://api.sandbox.namecheap.com/xml.response";

export interface NamecheapCredentials {
  apiUser: string;
  apiKey: string;
  username: string;
  /** Must be an IP address whitelisted in the Namecheap account (Profile > Tools > API Access). */
  clientIp: string;
  sandbox?: boolean;
}

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });

type NamecheapNode = Record<string, unknown>;

/**
 * Real domain registrar adapter for Namecheap. Every request is a POST of
 * form-encoded parameters to a single endpoint (Command=namecheap.domains.*),
 * and every response is XML with the shape
 * <ApiResponse Status="OK|ERROR"><CommandResponse>...</CommandResponse></ApiResponse>
 * -- there is no JSON mode. Two things about this API differ enough from the
 * payment providers already integrated to call out:
 *  - Auth is a 3-part whitelist (ApiUser/ApiKey/UserName all valid AND the
 *    calling IP on the account's whitelist), not just a secret key. A
 *    request from a non-whitelisted IP fails auth even with a correct key.
 *  - DNS host records are not managed incrementally: dns.setHosts always
 *    replaces the *entire* record set for a domain in one call, so
 *    createDNSRecord/deleteDNSRecord below read the full set with
 *    dns.getHosts, splice in the change, and write the whole set back.
 */
export class NamecheapDomainProvider implements DomainProvider {
  readonly key = "namecheap";
  readonly label = "Namecheap";
  readonly capabilities: DomainProviderCapabilities = {
    search: true,
    register: true,
    renew: true,
    transfer: true,
    dnsManagement: true,
    nameserverUpdate: true,
    requiresRegistrantContact: true,
  };

  private readonly baseUrl: string;

  constructor(private readonly creds: NamecheapCredentials) {
    this.baseUrl = creds.sandbox ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL;
  }

  private async call<T = NamecheapNode>(command: string, params: Record<string, string | number | undefined>): Promise<T> {
    const body = new URLSearchParams({
      ApiUser: this.creds.apiUser,
      ApiKey: this.creds.apiKey,
      UserName: this.creds.username,
      ClientIp: this.creds.clientIp,
      Command: command,
    });
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) body.set(key, String(value));
    }

    const res = await fetch(this.baseUrl, { method: "POST", body });
    const rawXml = await res.text();
    const parsed = xmlParser.parse(rawXml) as { ApiResponse?: { Status?: string; Errors?: { Error?: unknown }; CommandResponse?: T } };
    const apiResponse = parsed.ApiResponse;
    if (!apiResponse) {
      logger.error("namecheap.malformed_response", { command });
      throw new Error("Namecheap returned an unrecognized response.");
    }
    if (apiResponse.Status !== "OK") {
      const message = this.extractErrorMessage(apiResponse.Errors?.Error);
      logger.error("namecheap.api_error", { command, message });
      throw new Error(message || `Namecheap API error on ${command}`);
    }
    if (!apiResponse.CommandResponse) {
      throw new Error(`Namecheap returned no CommandResponse for ${command}`);
    }
    return apiResponse.CommandResponse;
  }

  private extractErrorMessage(errorNode: unknown): string {
    const toText = (node: unknown): string =>
      typeof node === "object" && node !== null ? String((node as NamecheapNode)["#text"] ?? "") : String(node ?? "");
    if (Array.isArray(errorNode)) return errorNode.map(toText).join("; ");
    if (errorNode) return toText(errorNode);
    return "";
  }

  async testConnection(): Promise<ProviderTestResult> {
    try {
      // No dedicated ping endpoint -- a cheap domains.check call proves the
      // ApiUser/ApiKey/UserName/ClientIp whitelist triple all check out,
      // regardless of whether the throwaway domain is actually available.
      await this.call("namecheap.domains.check", { DomainList: `connection-test-${Date.now()}.com` });
      return { state: "CONNECTED", message: "Connected to Namecheap.", checkedAt: new Date().toISOString() };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const lower = message.toLowerCase();
      // Namecheap's auth-triple errors all name one of these four
      // parameters (ApiUser/ApiKey/UserName/ClientIp) or say "missing"/
      // "invalid" -- e.g. "Parameter APIUser is missing", "Invalid request
      // IP: 1.2.3.4", "Parameter APIKey is invalid".
      const state =
        lower.includes("apiuser") ||
        lower.includes("apikey") ||
        lower.includes("api key") ||
        lower.includes("username") ||
        lower.includes("clientip") ||
        lower.includes(" ip") ||
        lower.includes("missing") ||
        lower.includes("invalid")
          ? "AUTH_FAILED"
          : "ENDPOINT_ERROR";
      return { state, message, checkedAt: new Date().toISOString() };
    }
  }

  async searchDomain(query: string, tlds: string[]): Promise<DomainSearchResult[]> {
    const clean = query.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    const domains = tlds.map((tld) => `${clean}.${tld}`);
    const response = await this.call<{ DomainCheckResult?: NamecheapNode | NamecheapNode[] }>("namecheap.domains.check", {
      DomainList: domains.join(","),
    });
    const raw = response.DomainCheckResult;
    const results = (Array.isArray(raw) ? raw : raw ? [raw] : []) as NamecheapNode[];

    const out: DomainSearchResult[] = [];
    for (let i = 0; i < tlds.length; i++) {
      const tld = tlds[i];
      const domain = domains[i];
      const match = results.find((r) => String(r.Domain ?? "").toLowerCase() === domain);
      const available = String(match?.Available ?? "false") === "true";
      const [registerQuote, renewQuote] = await Promise.all([
        this.getPricingQuote(domain, 1, "register").catch(() => ({ price: 0, currency: "USD" })),
        this.getPricingQuote(domain, 1, "renew").catch(() => ({ price: 0, currency: "USD" })),
      ]);
      out.push({
        domain,
        tld,
        available,
        registrationPrice: registerQuote.price,
        renewalPrice: renewQuote.price,
        currency: registerQuote.currency,
      });
    }
    return out;
  }

  async checkAvailability(domain: string): Promise<boolean> {
    const response = await this.call<{ DomainCheckResult?: NamecheapNode }>("namecheap.domains.check", { DomainList: domain });
    return String(response.DomainCheckResult?.Available ?? "false") === "true";
  }

  /**
   * Namecheap's exact response nesting for users.getPricing (ProductType >
   * ProductCategory > Product > Price, per its docs) wasn't fully
   * verifiable without a live sandbox call, so this walks the whole parsed
   * tree looking for nodes shaped like a price entry (a Duration alongside
   * a Price/YourPrice) instead of hard-coding an assumed depth -- correct
   * regardless of exactly how deep Price ends up nested.
   */
  private extractPriceEntries(node: unknown): NamecheapNode[] {
    const found: NamecheapNode[] = [];
    const walk = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (value && typeof value === "object") {
        const obj = value as NamecheapNode;
        if ("Duration" in obj && ("Price" in obj || "YourPrice" in obj)) {
          found.push(obj);
          return;
        }
        for (const key of Object.keys(obj)) walk(obj[key]);
      }
    };
    walk(node);
    return found;
  }

  async getPricingQuote(domain: string, years: number, action: "register" | "renew"): Promise<PricingQuote> {
    const { tld } = this.splitDomain(domain);
    const response = await this.call("namecheap.users.getPricing", {
      ProductType: "DOMAIN",
      ProductCategory: "DOMAINS",
      ActionName: action === "register" ? "REGISTER" : "RENEW",
      ProductName: tld,
    });
    const entries = this.extractPriceEntries(response);
    if (entries.length === 0) throw new Error(`Namecheap returned no pricing for .${tld}`);

    const exactMatch = entries.find((e) => Number(e.Duration) === years);
    const oneYear = entries.find((e) => Number(e.Duration) === 1) ?? entries[0];
    const priceOf = (e: NamecheapNode) => Number(e.YourPrice ?? e.Price ?? 0);

    const total = exactMatch ? priceOf(exactMatch) : priceOf(oneYear) * years;
    const currency = String((exactMatch ?? oneYear).Currency ?? "USD");
    return { price: Math.round(total * 100) / 100, currency };
  }

  private static readonly COUNTRY_DIAL_CODES: Record<string, string> = {
    "united states": "1",
    usa: "1",
    us: "1",
    canada: "1",
    nigeria: "234",
    ng: "234",
    "united kingdom": "44",
    uk: "44",
    gb: "44",
    ghana: "233",
    kenya: "254",
    "south africa": "27",
    germany: "49",
    france: "33",
    india: "91",
  };

  /** Namecheap requires phone numbers as "+CC.NNNNNNNNNN". Best-effort normalization from a plain number + country name. */
  private formatPhone(rawPhone: string, country?: string): string {
    const trimmed = rawPhone.trim();
    if (/^\+\d{1,3}\.\d+$/.test(trimmed)) return trimmed;
    const digitsOnly = trimmed.replace(/\D/g, "");
    const dialCode = country ? NamecheapDomainProvider.COUNTRY_DIAL_CODES[country.trim().toLowerCase()] : undefined;
    if (dialCode) {
      const nationalNumber = digitsOnly.startsWith(dialCode) ? digitsOnly.slice(dialCode.length) : digitsOnly;
      return `+${dialCode}.${nationalNumber}`;
    }
    // Unknown country -- if the input already looked international (leading
    // "+"), assume a 1-3 digit country code prefix as a last resort.
    return trimmed.startsWith("+") ? `+${digitsOnly.slice(0, 3)}.${digitsOnly.slice(3)}` : `+${digitsOnly}`;
  }

  private assertRegistrantContact(input: RegisterDomainInput): void {
    const required = [
      input.registrantAddress1,
      input.registrantCity,
      input.registrantStateProvince,
      input.registrantPostalCode,
      input.registrantCountry,
      input.registrantPhone,
    ];
    if (required.some((value) => !value)) {
      throw new Error(
        "Domain registration requires a complete registrant address (street address, city, state/province, postal code, country, phone) on the customer's profile."
      );
    }
  }

  async registerDomain(input: RegisterDomainInput): Promise<RegisterDomainResult> {
    this.assertRegistrantContact(input);
    const [firstName, ...rest] = input.customerName.trim().split(/\s+/);
    const lastName = rest.join(" ") || firstName;
    const phone = this.formatPhone(input.registrantPhone!, input.registrantCountry);

    const contactFields: Record<string, string> = {
      FirstName: firstName,
      LastName: lastName,
      Address1: input.registrantAddress1!,
      City: input.registrantCity!,
      StateProvince: input.registrantStateProvince!,
      PostalCode: input.registrantPostalCode!,
      Country: input.registrantCountry!,
      Phone: phone,
      EmailAddress: input.customerEmail,
    };

    const params: Record<string, string | number> = {
      DomainName: input.domain,
      Years: input.years,
      AddFreeWhoisguard: "yes",
      WGEnabled: "yes",
    };
    for (const prefix of ["Registrant", "Tech", "Admin", "AuxBilling"]) {
      for (const [field, value] of Object.entries(contactFields)) {
        params[`${prefix}${field}`] = value;
      }
    }
    if (input.nameservers?.length) params.Nameservers = input.nameservers.join(",");

    const response = await this.call<{ DomainCreateResult?: NamecheapNode }>("namecheap.domains.create", params);
    const result = response.DomainCreateResult;
    if (String(result?.Registered ?? "false") !== "true") {
      throw new Error(`Namecheap did not confirm registration for ${input.domain}`);
    }

    const now = new Date();
    const expires = new Date(now);
    expires.setFullYear(expires.getFullYear() + input.years);

    return {
      providerRef: String(result?.DomainID ?? result?.OrderID ?? input.domain),
      registeredAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      nameservers: input.nameservers ?? [],
    };
  }

  async renewDomain(domain: string, years: number): Promise<{ expiresAt: string }> {
    const response = await this.call<{ DomainRenewResult?: NamecheapNode }>("namecheap.domains.renew", { DomainName: domain, Years: years });
    const details = response.DomainRenewResult?.DomainDetails as NamecheapNode | undefined;
    const expiredDate = details?.ExpiredDate;
    if (typeof expiredDate === "string") {
      return { expiresAt: new Date(expiredDate).toISOString() };
    }
    // Namecheap didn't echo the new expiry where we expected -- compute it
    // from "now" rather than fail a renewal that otherwise succeeded.
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() + years);
    return { expiresAt: fallback.toISOString() };
  }

  async transferDomain(domain: string, authCode: string): Promise<{ providerRef: string; status: string }> {
    const response = await this.call<{ DomainTransferCreateResult?: NamecheapNode }>("namecheap.domains.transfer.create", {
      DomainName: domain,
      EPPCode: authCode,
    });
    const result = response.DomainTransferCreateResult;
    return {
      providerRef: String(result?.TransferID ?? domain),
      status: String(result?.Transfer ?? "false") === "true" ? "PENDING" : "FAILED",
    };
  }

  private splitDomain(domain: string): { sld: string; tld: string } {
    const [sld, ...rest] = domain.split(".");
    return { sld, tld: rest.join(".") };
  }

  private async getNameservers(domain: string): Promise<string[]> {
    const { sld, tld } = this.splitDomain(domain);
    const response = await this.call<{ DomainDNSGetListResult?: NamecheapNode }>("namecheap.domains.dns.getList", { SLD: sld, TLD: tld });
    const nameserver = response.DomainDNSGetListResult?.Nameserver;
    if (!nameserver) return [];
    return (Array.isArray(nameserver) ? nameserver : [nameserver]).map(String);
  }

  async getDomainDetails(domain: string): Promise<DomainDetails> {
    const response = await this.call<{ DomainGetInfoResult?: NamecheapNode }>("namecheap.domains.getInfo", { DomainName: domain });
    const result = response.DomainGetInfoResult;
    const details = (result?.DomainDetails ?? {}) as NamecheapNode;
    const statusRaw = String(result?.Status ?? "").toLowerCase();
    const status: DomainDetails["status"] =
      statusRaw === "expired" ? "EXPIRED" : statusRaw === "transferred" ? "TRANSFERRED" : "ACTIVE";
    const nameservers = await this.getNameservers(domain).catch(() => []);

    return {
      domain,
      status,
      expiresAt: typeof details.ExpiredDate === "string" ? new Date(details.ExpiredDate).toISOString() : new Date().toISOString(),
      nameservers,
      // getInfo doesn't expose a documented per-domain auto-renew flag;
      // Namecheap enables auto-renew account-wide by default, so this is a
      // reasonable default rather than a genuine read of per-domain state.
      autoRenew: true,
    };
  }

  async updateNameservers(domain: string, nameservers: string[]): Promise<void> {
    const { sld, tld } = this.splitDomain(domain);
    await this.call("namecheap.domains.dns.setCustom", { SLD: sld, TLD: tld, Nameservers: nameservers.join(",") });
  }

  private async getHosts(domain: string): Promise<NamecheapNode[]> {
    const { sld, tld } = this.splitDomain(domain);
    const response = await this.call<{ DomainDNSGetHostsResult?: NamecheapNode }>("namecheap.domains.dns.getHosts", { SLD: sld, TLD: tld });
    const host = response.DomainDNSGetHostsResult?.host;
    if (!host) return [];
    return (Array.isArray(host) ? host : [host]) as NamecheapNode[];
  }

  private async setHosts(domain: string, hosts: NamecheapNode[]): Promise<void> {
    const { sld, tld } = this.splitDomain(domain);
    const params: Record<string, string> = { SLD: sld, TLD: tld };
    hosts.forEach((h, i) => {
      const n = i + 1;
      params[`HostName${n}`] = String(h.Name ?? h.HostName ?? "@");
      params[`RecordType${n}`] = String(h.Type ?? h.RecordType ?? "A");
      params[`Address${n}`] = String(h.Address ?? "");
      params[`TTL${n}`] = String(h.TTL ?? 1800);
      if (h.MXPref !== undefined) params[`MXPref${n}`] = String(h.MXPref);
    });
    const response = await this.call<{ DomainDNSSetHostsResult?: NamecheapNode }>("namecheap.domains.dns.setHosts", params);
    if (String(response.DomainDNSSetHostsResult?.IsSuccess ?? "false") !== "true") {
      throw new Error(`Namecheap failed to update DNS records for ${domain}`);
    }
  }

  async createDNSRecord(input: DNSRecordInput): Promise<{ providerRecordId: string }> {
    const existing = await this.getHosts(input.domain);
    const newHost: NamecheapNode = {
      Name: input.name,
      Type: input.type,
      Address: input.value,
      TTL: String(input.ttl ?? 1800),
      ...(input.priority !== undefined ? { MXPref: String(input.priority) } : {}),
    };
    await this.setHosts(input.domain, [...existing, newHost]);

    // Namecheap only assigns a HostId once the record exists server-side --
    // re-fetch and match on what we just sent to recover it.
    const after = await this.getHosts(input.domain);
    const match = after.find(
      (h) => String(h.Name ?? h.HostName) === input.name && String(h.Type ?? h.RecordType) === input.type && String(h.Address) === input.value
    );
    const providerRecordId = match?.HostId ? String(match.HostId) : `${input.domain}:${input.name}:${input.type}`;
    return { providerRecordId };
  }

  async deleteDNSRecord(domain: string, providerRecordId: string): Promise<void> {
    const existing = await this.getHosts(domain);
    const remaining = existing.filter((h) => String(h.HostId) !== providerRecordId);
    if (remaining.length === existing.length) return;
    await this.setHosts(domain, remaining);
  }
}
