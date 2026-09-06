import { ProviderAdapterBase } from "../types";

export interface CreateHostingAccountInput {
  planCode: string;
  customerEmail: string;
  domain: string;
}

export interface HostingAccountRef {
  providerAccountId: string;
  status: "ACTIVE" | "PENDING" | "SUSPENDED";
  controlPanelUrl?: string;
}

export interface HostingUsage {
  storageUsedGB: number;
  bandwidthUsedGB: number;
  websitesUsed: number;
}

export interface HostingProvider extends ProviderAdapterBase {
  createAccount(input: CreateHostingAccountInput): Promise<HostingAccountRef>;
  suspendAccount(providerAccountId: string): Promise<void>;
  unsuspendAccount(providerAccountId: string): Promise<void>;
  deleteAccount(providerAccountId: string): Promise<void>;
  getAccount(providerAccountId: string): Promise<HostingAccountRef>;
  getUsage(providerAccountId: string): Promise<HostingUsage>;
  getServerStatus(providerAccountId: string): Promise<"online" | "degraded" | "offline">;
  upgradePlan(providerAccountId: string, newPlanCode: string): Promise<void>;
  downgradePlan(providerAccountId: string, newPlanCode: string): Promise<void>;
}
