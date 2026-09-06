import { ProviderAdapterBase } from "../types";

/**
 * Non-secret connection metadata. Actual credentials are resolved at
 * execution time from DeploymentCredential (encrypted) and are never part of
 * this object so they can't accidentally be logged alongside it.
 */
export interface DeploymentTarget {
  deploymentId: string;
  adapter: "ssh" | "cpanel" | "plesk" | "docker" | "cloud";
  host?: string;
  port?: number;
  controlPanelUrl?: string;
}

export interface DeploymentStepInput {
  target: DeploymentTarget;
  applicationSlug: string;
  version: string;
  runtime: string;
  buildCommand?: string | null;
  startCommand?: string | null;
  envVars: Record<string, string>;
}

export interface DeploymentStepResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  httpOk: boolean;
  httpsOk: boolean;
  sslValid: boolean;
  applicationHealthy: boolean;
}

/**
 * Adapters encapsulate how commands actually get executed against a target
 * (SSH session, cPanel API call, Docker API, etc). Commands are always
 * generated from validated configuration in DeploymentStepInput -- adapters
 * must never interpolate raw user strings directly into a shell command.
 */
export interface DeploymentProviderAdapter extends ProviderAdapterBase {
  connect(target: DeploymentTarget): Promise<DeploymentStepResult>;
  prepareEnvironment(input: DeploymentStepInput): Promise<DeploymentStepResult>;
  installApplication(input: DeploymentStepInput): Promise<DeploymentStepResult>;
  configureDomain(target: DeploymentTarget, domain: string): Promise<DeploymentStepResult>;
  issueSSL(target: DeploymentTarget, domain: string): Promise<DeploymentStepResult>;
  runHealthCheck(target: DeploymentTarget, url: string): Promise<HealthCheckResult>;
}
