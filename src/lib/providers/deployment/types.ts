import { ProviderAdapterBase } from "../types";

/**
 * Non-secret connection metadata resolved from a DeploymentTarget row.
 * Actual credentials are resolved at execution time from
 * DeploymentCredential (encrypted) and are never part of this object so
 * they can't accidentally be logged alongside it. Named distinctly from the
 * Prisma `DeploymentTarget` model (this is the adapter-facing view of it).
 */
export interface DeploymentConnectionTarget {
  deploymentId: string;
  deploymentTargetId?: string;
  adapter: "ssh" | "cpanel" | "plesk" | "docker" | "cloud" | "mock";
  host?: string;
  port?: number;
  controlPanelUrl?: string;
}

export interface DeploymentStepInput {
  target: DeploymentConnectionTarget;
  applicationSlug: string;
  version: string;
  runtime: string;
  buildCommand?: string | null;
  startCommand?: string | null;
  installCommand?: string | null;
  migrationCommand?: string | null;
  envVars: Record<string, string>;
}

export interface DeploymentStepResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidateTargetResult {
  valid: boolean;
  message: string;
  /** Errors here are configuration problems (bad credentials, unsupported runtime) -> NEEDS_CUSTOMER_ACTION, never endlessly retried. */
  isConfigurationError?: boolean;
}

export interface HealthCheckResult {
  httpOk: boolean;
  httpsOk: boolean;
  sslValid: boolean;
  applicationHealthy: boolean;
}

export interface DeploymentStatusResult {
  status: "running" | "stopped" | "unknown";
  details?: Record<string, unknown>;
}

/**
 * Adapters encapsulate how commands actually get executed against a target
 * (SSH session, cPanel API call, Docker API, etc). Commands are always
 * generated from validated configuration in DeploymentStepInput -- adapters
 * must never interpolate raw user strings directly into a shell command.
 */
export interface DeploymentProviderAdapter extends ProviderAdapterBase {
  /** Sanity-checks target reachability/credentials before any provisioning starts. */
  validateTarget(target: DeploymentConnectionTarget): Promise<ValidateTargetResult>;
  connect(target: DeploymentConnectionTarget): Promise<DeploymentStepResult>;
  prepareEnvironment(input: DeploymentStepInput): Promise<DeploymentStepResult>;
  deploy(input: DeploymentStepInput): Promise<DeploymentStepResult>;
  configureEnvironment(input: DeploymentStepInput): Promise<DeploymentStepResult>;
  configureDomain(target: DeploymentConnectionTarget, domain: string): Promise<DeploymentStepResult>;
  configureSSL(target: DeploymentConnectionTarget, domain: string): Promise<DeploymentStepResult>;
  runMigrations(input: DeploymentStepInput): Promise<DeploymentStepResult>;
  runHealthCheck(target: DeploymentConnectionTarget, url: string): Promise<HealthCheckResult>;
  rollback(target: DeploymentConnectionTarget, toVersion: string): Promise<DeploymentStepResult>;
  getStatus(target: DeploymentConnectionTarget): Promise<DeploymentStatusResult>;
  destroy(target: DeploymentConnectionTarget): Promise<DeploymentStepResult>;
}
