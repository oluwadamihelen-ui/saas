import { ProviderTestResult } from "../types";
import {
  DeploymentConnectionTarget,
  DeploymentProviderAdapter,
  DeploymentStatusResult,
  DeploymentStepInput,
  DeploymentStepResult,
  HealthCheckResult,
  ValidateTargetResult,
} from "./types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulates every deployment adapter (SSH/cPanel/Plesk/Docker/Cloud) behind
 * one implementation so the job pipeline (validate -> connect -> install ->
 * configure -> migrate -> DNS -> SSL -> health check) can be exercised
 * end-to-end without real infrastructure. Never represented to the customer
 * as anything other than demo infrastructure -- see DeploymentTarget.type
 * "MOCK" and its "(Demo Mode)" labeling throughout the UI.
 */
export class MockDeploymentProvider implements DeploymentProviderAdapter {
  readonly key = "mock";
  readonly label = "Mock Deployment (Demo Mode)";

  async testConnection(): Promise<ProviderTestResult> {
    return { state: "CONNECTED", message: "Mock deployment provider always connects.", checkedAt: new Date().toISOString() };
  }

  async validateTarget(target: DeploymentConnectionTarget): Promise<ValidateTargetResult> {
    await delay(150);
    if (target.adapter === "ssh" && !target.host) {
      return { valid: false, message: "No server hostname configured for this target.", isConfigurationError: true };
    }
    return { valid: true, message: "Target validated (simulated)." };
  }

  async connect(target: DeploymentConnectionTarget): Promise<DeploymentStepResult> {
    await delay(300);
    return { success: true, message: `Connected via ${target.adapter} adapter (simulated).` };
  }

  async prepareEnvironment(input: DeploymentStepInput): Promise<DeploymentStepResult> {
    await delay(300);
    return { success: true, message: `Prepared ${input.runtime} runtime environment.` };
  }

  async deploy(input: DeploymentStepInput): Promise<DeploymentStepResult> {
    await delay(500);
    return { success: true, message: `Installed ${input.applicationSlug}@${input.version}.` };
  }

  async configureEnvironment(input: DeploymentStepInput): Promise<DeploymentStepResult> {
    await delay(200);
    const count = Object.keys(input.envVars).length;
    return { success: true, message: `Configured ${count} environment variable${count === 1 ? "" : "s"}.` };
  }

  async configureDomain(_target: DeploymentConnectionTarget, domain: string): Promise<DeploymentStepResult> {
    await delay(300);
    return { success: true, message: `Configured DNS for ${domain} (simulated).` };
  }

  async configureSSL(_target: DeploymentConnectionTarget, domain: string): Promise<DeploymentStepResult> {
    await delay(300);
    return { success: true, message: `Issued SSL certificate for ${domain} (simulated).` };
  }

  async runMigrations(input: DeploymentStepInput): Promise<DeploymentStepResult> {
    await delay(250);
    if (!input.migrationCommand) return { success: true, message: "No database migrations configured for this version." };
    return { success: true, message: `Ran migrations: ${input.migrationCommand} (simulated).` };
  }

  async runHealthCheck(_target: DeploymentConnectionTarget, _url: string): Promise<HealthCheckResult> {
    await delay(200);
    return { httpOk: true, httpsOk: true, sslValid: true, applicationHealthy: true };
  }

  async rollback(_target: DeploymentConnectionTarget, toVersion: string): Promise<DeploymentStepResult> {
    await delay(400);
    return { success: true, message: `Rolled back to ${toVersion} (simulated).` };
  }

  async getStatus(_target: DeploymentConnectionTarget): Promise<DeploymentStatusResult> {
    return { status: "running" };
  }

  async destroy(_target: DeploymentConnectionTarget): Promise<DeploymentStepResult> {
    await delay(200);
    return { success: true, message: "Deployment resources destroyed (simulated)." };
  }
}
