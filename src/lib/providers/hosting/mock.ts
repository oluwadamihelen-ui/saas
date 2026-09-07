import crypto from "crypto";
import { ProviderTestResult } from "../types";
import {
  CreateHostingAccountInput,
  HostingAccountRef,
  HostingProvider,
  HostingUsage,
} from "./types";

interface MockHostingAccount extends HostingAccountRef {
  planCode: string;
  createdAt: number;
}

const accounts = new Map<string, MockHostingAccount>();

// Deterministic pseudo-usage per account -- stays stable between calls
// (like a real account's usage would, roughly, between two checks a few
// seconds apart) instead of jumping randomly on every read, and grows
// slowly with how long the account has existed rather than being static.
function pseudoUsage(providerAccountId: string, ageMs: number): HostingUsage {
  const hash = crypto.createHash("md5").update(providerAccountId).digest();
  const base = hash.readUInt8(0) / 255; // 0..1, stable per account
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
  return {
    storageUsedGB: Number((1 + base * 4 + ageDays * 0.05).toFixed(2)),
    bandwidthUsedGB: Number((2 + base * 15 + ageDays * 0.3).toFixed(2)),
    websitesUsed: 1,
  };
}

export class MockHostingProvider implements HostingProvider {
  readonly key = "mock";
  readonly label = "Mock Hosting (Demo Mode)";

  async testConnection(): Promise<ProviderTestResult> {
    return { state: "CONNECTED", message: "Mock hosting always connects.", checkedAt: new Date().toISOString() };
  }

  async createAccount(input: CreateHostingAccountInput): Promise<HostingAccountRef> {
    const providerAccountId = `mock_hosting_${crypto.randomUUID()}`;
    const account: MockHostingAccount = {
      providerAccountId,
      status: "ACTIVE",
      controlPanelUrl: `https://panel.mockhost.example/${providerAccountId}`,
      planCode: input.planCode,
      createdAt: Date.now(),
    };
    accounts.set(providerAccountId, account);
    return account;
  }

  /**
   * Looks up an account, lazily registering a default record if this
   * instance never saw it created (e.g. seed data writes a HostingAccount
   * row with a synthetic providerAccountId directly, without ever calling
   * createAccount). Our database is the source of truth for which accounts
   * exist -- if the caller has a providerAccountId, we treat it as real
   * rather than rejecting an otherwise-valid operation on it.
   */
  private getOrRegister(providerAccountId: string): MockHostingAccount {
    let account = accounts.get(providerAccountId);
    if (!account) {
      account = { providerAccountId, status: "ACTIVE", planCode: "unknown", createdAt: Date.now() };
      accounts.set(providerAccountId, account);
    }
    return account;
  }

  async suspendAccount(providerAccountId: string): Promise<void> {
    this.getOrRegister(providerAccountId).status = "SUSPENDED";
  }

  async unsuspendAccount(providerAccountId: string): Promise<void> {
    this.getOrRegister(providerAccountId).status = "ACTIVE";
  }

  async deleteAccount(providerAccountId: string): Promise<void> {
    accounts.delete(providerAccountId);
  }

  async getAccount(providerAccountId: string): Promise<HostingAccountRef> {
    return accounts.get(providerAccountId) ?? { providerAccountId, status: "PENDING" };
  }

  async getUsage(providerAccountId: string): Promise<HostingUsage> {
    const account = accounts.get(providerAccountId);
    return pseudoUsage(providerAccountId, account ? Date.now() - account.createdAt : 0);
  }

  async getServerStatus(): Promise<"online" | "degraded" | "offline"> {
    return "online";
  }

  async upgradePlan(providerAccountId: string, newPlanCode: string): Promise<void> {
    this.getOrRegister(providerAccountId).planCode = newPlanCode;
  }

  async downgradePlan(providerAccountId: string, newPlanCode: string): Promise<void> {
    this.getOrRegister(providerAccountId).planCode = newPlanCode;
  }
}
