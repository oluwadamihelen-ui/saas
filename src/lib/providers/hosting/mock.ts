import crypto from "crypto";
import { ProviderTestResult } from "../types";
import {
  CreateHostingAccountInput,
  HostingAccountRef,
  HostingProvider,
  HostingUsage,
} from "./types";

const accounts = new Map<string, HostingAccountRef>();

export class MockHostingProvider implements HostingProvider {
  readonly key = "mock";
  readonly label = "Mock Hosting (Demo Mode)";

  async testConnection(): Promise<ProviderTestResult> {
    return { state: "CONNECTED", message: "Mock hosting always connects.", checkedAt: new Date().toISOString() };
  }

  async createAccount(_input: CreateHostingAccountInput): Promise<HostingAccountRef> {
    const providerAccountId = `mock_hosting_${crypto.randomUUID()}`;
    const ref: HostingAccountRef = {
      providerAccountId,
      status: "ACTIVE",
      controlPanelUrl: `https://panel.mockhost.example/${providerAccountId}`,
    };
    accounts.set(providerAccountId, ref);
    return ref;
  }

  async suspendAccount(providerAccountId: string): Promise<void> {
    const ref = accounts.get(providerAccountId);
    if (ref) ref.status = "SUSPENDED";
  }

  async unsuspendAccount(providerAccountId: string): Promise<void> {
    const ref = accounts.get(providerAccountId);
    if (ref) ref.status = "ACTIVE";
  }

  async deleteAccount(providerAccountId: string): Promise<void> {
    accounts.delete(providerAccountId);
  }

  async getAccount(providerAccountId: string): Promise<HostingAccountRef> {
    return accounts.get(providerAccountId) ?? { providerAccountId, status: "PENDING" };
  }

  async getUsage(_providerAccountId: string): Promise<HostingUsage> {
    return {
      storageUsedGB: Number((Math.random() * 5).toFixed(2)),
      bandwidthUsedGB: Number((Math.random() * 20).toFixed(2)),
      websitesUsed: 1,
    };
  }

  async getServerStatus(): Promise<"online" | "degraded" | "offline"> {
    return "online";
  }

  async upgradePlan(): Promise<void> {
    return;
  }

  async downgradePlan(): Promise<void> {
    return;
  }
}
