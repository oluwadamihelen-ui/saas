import crypto from "crypto";
import { logger } from "@/lib/security/logger";
import { ProviderTestResult } from "../types";
import { CreateHostingAccountInput, HostingAccountRef, HostingProvider, HostingUsage } from "./types";

export interface CPanelCredentials {
  /** WHM server hostname (the box hosting cPanel accounts), e.g. "server1.example.com". */
  host: string;
  /** WHM API port. 2087 is the standard SSL port. */
  port?: number;
  /** The WHM account used to authenticate -- "root" or a reseller username. */
  username: string;
  /** WHM API Token (WHM > Development > Manage API Tokens), not the account password. */
  apiToken: string;
}

interface WhmResponse<T> {
  metadata: { version: number; result: number; reason: string; command?: string };
  data?: T;
}

/**
 * Real hosting adapter for cPanel/WHM (the classic reseller-hosting API
 * that Hosting-Plan-with-limits/create-suspend-terminate maps onto almost
 * 1:1). Every call is a GET against
 * https://<host>:<port>/json-api/<function>?api.version=1&<params>, using
 * WHM API tokens (`Authorization: whm <username>:<token>`) rather than the
 * account password -- WHM's own recommended auth method. Every function
 * response shares one envelope: {metadata:{result,reason},data:{...}};
 * result===1 is success regardless of which function was called.
 *
 * WHM identifies accounts by cPanel username, not an opaque id -- so
 * `providerAccountId` here *is* the cPanel username, generated from the
 * requested domain since CreateHostingAccountInput doesn't supply one.
 */
export class CPanelHostingProvider implements HostingProvider {
  readonly key = "cpanel";
  readonly label = "cPanel/WHM";

  private readonly baseUrl: string;

  constructor(private readonly creds: CPanelCredentials) {
    const port = creds.port ?? 2087;
    this.baseUrl = `https://${creds.host}:${port}/json-api`;
  }

  private async call<T = Record<string, unknown>>(fn: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const query = new URLSearchParams({ "api.version": "1" });
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }

    const res = await fetch(`${this.baseUrl}/${fn}?${query.toString()}`, {
      headers: { Authorization: `whm ${this.creds.username}:${this.creds.apiToken}` },
    });

    if (!res.ok) {
      logger.error("cpanel.http_error", { fn, status: res.status });
      throw new Error(`WHM request to ${fn} failed with HTTP ${res.status}`);
    }

    let parsed: WhmResponse<T>;
    try {
      parsed = (await res.json()) as WhmResponse<T>;
    } catch {
      throw new Error(`WHM returned a non-JSON response for ${fn} (check host/port -- likely not talking to the WHM API).`);
    }

    if (parsed.metadata?.result !== 1) {
      const reason = parsed.metadata?.reason || `WHM API error on ${fn}`;
      logger.error("cpanel.api_error", { fn, reason });
      throw new Error(reason);
    }
    return (parsed.data ?? ({} as T)) as T;
  }

  async testConnection(): Promise<ProviderTestResult> {
    try {
      // "version" is a lightweight, read-only, side-effect-free call --
      // enough to prove the host/port/username/token are all correct.
      await this.call("version");
      return { state: "CONNECTED", message: "Connected to WHM.", checkedAt: new Date().toISOString() };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const lower = message.toLowerCase();
      const state =
        lower.includes("access denied") ||
        lower.includes("invalid") ||
        lower.includes("unauthorized") ||
        lower.includes("token") ||
        lower.includes("login") ||
        lower.includes("http 401") ||
        lower.includes("http 403")
          ? "AUTH_FAILED"
          : "ENDPOINT_ERROR";
      return { state, message, checkedAt: new Date().toISOString() };
    }
  }

  /** cPanel usernames: 1-16 chars, must start with a letter, lowercase alphanumeric only, unique server-wide. */
  private generateUsername(domain: string): string {
    const cleaned = domain.split(".")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    const base = (cleaned || "acct").slice(0, 8);
    const prefixed = /^[a-z]/.test(base) ? base : `u${base}`;
    const suffix = crypto.randomBytes(3).toString("hex"); // 6 chars, keeps collisions negligible
    return `${prefixed}${suffix}`.slice(0, 16);
  }

  private generatePassword(): string {
    // 20 random bytes, base64url -> a long, high-entropy password that
    // satisfies any cPanel complexity policy without needing to reverse-
    // engineer the server's specific rules.
    return crypto.randomBytes(20).toString("base64url");
  }

  async createAccount(input: CreateHostingAccountInput): Promise<HostingAccountRef> {
    const username = this.generateUsername(input.domain);
    const password = this.generatePassword();

    await this.call("createacct", {
      username,
      domain: input.domain,
      password,
      contactemail: input.customerEmail,
      plan: input.planCode,
    });

    return {
      providerAccountId: username,
      status: "ACTIVE",
      // The customer's domain may not point at this server's DNS yet, so
      // the server's own hostname is the one login URL guaranteed to work
      // immediately -- not the (possibly-unresolvable) customer domain.
      controlPanelUrl: `https://${this.creds.host}:2083`,
      initialPassword: password,
    };
  }

  async suspendAccount(providerAccountId: string): Promise<void> {
    await this.call("suspendacct", { user: providerAccountId, reason: "Suspended via BridgeCodes" });
  }

  async unsuspendAccount(providerAccountId: string): Promise<void> {
    await this.call("unsuspendacct", { user: providerAccountId });
  }

  async deleteAccount(providerAccountId: string): Promise<void> {
    await this.call("removeacct", { user: providerAccountId });
  }

  async getAccount(providerAccountId: string): Promise<HostingAccountRef> {
    const data = await this.call<{ acct?: Array<{ suspended?: number | boolean }> }>("accountsummary", { user: providerAccountId });
    const acct = data.acct?.[0];
    const suspended = acct ? Boolean(Number(acct.suspended)) : false;
    return {
      providerAccountId,
      status: suspended ? "SUSPENDED" : "ACTIVE",
      controlPanelUrl: `https://${this.creds.host}:2083`,
    };
  }

  /** Parses a WHM disk-usage field: a plain MB number, or the string "unlimited". */
  private parseMbField(value: unknown): number | null {
    if (value === undefined || value === null) return null;
    if (typeof value === "string" && value.toLowerCase() === "unlimited") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  async getUsage(providerAccountId: string): Promise<HostingUsage> {
    const data = await this.call<{ acct?: Array<{ diskused?: unknown; disklimit?: unknown }> }>("accountsummary", {
      user: providerAccountId,
    });
    const acct = data.acct?.[0];
    const diskUsedMb = this.parseMbField(acct?.diskused) ?? 0;

    // Bandwidth isn't available from accountsummary -- WHM's showbw needs a
    // month/year and its exact response shape wasn't verifiable without a
    // live server to test against, so this is left at 0 rather than
    // guessing a field name that might silently be wrong. Worth wiring up
    // for real once there's a sandbox WHM account to verify showbw against.
    return {
      storageUsedGB: Math.round((diskUsedMb / 1024) * 100) / 100,
      bandwidthUsedGB: 0,
      // Counts only the primary domain -- doesn't yet include addon
      // domains under the account (would need a separate
      // listaddondomains call), so this undercounts multi-site accounts.
      websitesUsed: 1,
    };
  }

  async getServerStatus(): Promise<"online" | "degraded" | "offline"> {
    try {
      await this.call("version");
      return "online";
    } catch {
      return "offline";
    }
  }

  async upgradePlan(providerAccountId: string, newPlanCode: string): Promise<void> {
    await this.call("changepackage", { user: providerAccountId, pkg: newPlanCode });
  }

  async downgradePlan(providerAccountId: string, newPlanCode: string): Promise<void> {
    await this.call("changepackage", { user: providerAccountId, pkg: newPlanCode });
  }
}
