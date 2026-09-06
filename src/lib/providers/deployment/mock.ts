import { ProviderTestResult } from "../types";
import {
  DeploymentProviderAdapter,
  DeploymentStepInput,
  DeploymentStepResult,
  DeploymentTarget,
  HealthCheckResult,
} from "./types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulates every deployment adapter (SSH/cPanel/Plesk/Docker/Cloud) behind
 * one implementation so the job pipeline (queue -> connect -> install ->
 * configure -> DNS -> SSL -> health check) can be exercised end-to-end
 * without real infrastructure.
 */
export class MockDeploymentProvider implements DeploymentProviderAdapter {
  readonly key = "mock";
  readonly label = "Mock Deployment (Demo Mode)";

  async testConnection(): Promise<ProviderTestResult> {
    return { state: "CONNECTED", message: "Mock deployment provider always connects.", checkedAt: new Date().toISOString() };
  }

  async connect(target: DeploymentTarget): Promise<DeploymentStepResult> {
    await delay(300);
    return { success: true, message: `Connected via ${target.adapter} adapter (simulated).` };
  }

  async prepareEnvironment(input: DeploymentStepInput): Promise<DeploymentStepResult> {
    await delay(300);
    return { success: true, message: `Prepared ${input.runtime} runtime environment.` };
  }

  async installApplication(input: DeploymentStepInput): Promise<DeploymentStepResult> {
    await delay(500);
    return { success: true, message: `Installed ${input.applicationSlug}@${input.version}.` };
  }

  async configureDomain(_target: DeploymentTarget, domain: string): Promise<DeploymentStepResult> {
    await delay(300);
    return { success: true, message: `Configured DNS for ${domain} (simulated).` };
  }

  async issueSSL(_target: DeploymentTarget, domain: string): Promise<DeploymentStepResult> {
    await delay(300);
    return { success: true, message: `Issued SSL certificate for ${domain} (simulated).` };
  }

  async runHealthCheck(_target: DeploymentTarget, _url: string): Promise<HealthCheckResult> {
    await delay(200);
    return { httpOk: true, httpsOk: true, sslValid: true, applicationHealthy: true };
  }
}
