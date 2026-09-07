import { DeploymentProviderAdapter } from "./types";
import { MockDeploymentProvider } from "./mock";
import { SSHDeploymentAdapter } from "./ssh";

/**
 * Resolves an adapter by key (the same key stored on DeploymentTarget.provider
 * and Provider.adapterKey). Adding a real adapter for a key that's still
 * mock is just registering it here -- nothing else in the deployment
 * pipeline changes.
 */
class DeploymentAdapterRegistry {
  private readonly adapters = new Map<string, DeploymentProviderAdapter>();
  private readonly mock = new MockDeploymentProvider();

  constructor() {
    // Every adapter key Phase 3 anticipates (3.7 / 3.22) resolves to the
    // mock implementation until a real one is registered for that key.
    for (const key of ["ssh", "cpanel", "plesk", "docker", "cloud", "mock"]) {
      this.adapters.set(key, this.mock);
    }
    this.adapters.set("ssh", new SSHDeploymentAdapter());
  }

  register(key: string, adapter: DeploymentProviderAdapter) {
    this.adapters.set(key, adapter);
  }

  resolve(key: string): DeploymentProviderAdapter {
    return this.adapters.get(key) ?? this.mock;
  }
}

export const deploymentAdapterRegistry = new DeploymentAdapterRegistry();
