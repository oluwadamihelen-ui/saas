/**
 * Pulled out of index.ts so this safety-critical decision is directly
 * unit-testable without importing the seed script itself (which runs
 * main() as a side effect on import).
 */
export interface SeedMode {
  nodeEnv: string;
  isProduction: boolean;
  /** Whether to seed demo/sample data -- accounts with a published, shared password, fake orders, apps, etc. */
  seedDemoData: boolean;
}

export function resolveSeedMode(env: Record<string, string | undefined> = process.env): SeedMode {
  const nodeEnv = env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
  const seedDemoData = env.SEED_DEMO_DATA === "true" || !isProduction;
  return { nodeEnv, isProduction, seedDemoData };
}
