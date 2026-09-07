import { describe, it, expect } from "vitest";
import { resolveSeedMode } from "../../prisma/seed/env";

describe("resolveSeedMode: production safety guard for the seed script", () => {
  it("seeds demo data by default outside production", () => {
    expect(resolveSeedMode({}).seedDemoData).toBe(true);
    expect(resolveSeedMode({ NODE_ENV: "development" }).seedDemoData).toBe(true);
    expect(resolveSeedMode({ NODE_ENV: "test" }).seedDemoData).toBe(true);
  });

  it("skips demo data in production by default", () => {
    const result = resolveSeedMode({ NODE_ENV: "production" });
    expect(result.isProduction).toBe(true);
    expect(result.seedDemoData).toBe(false);
  });

  it("seeds demo data in production only when explicitly forced with SEED_DEMO_DATA=true", () => {
    const result = resolveSeedMode({ NODE_ENV: "production", SEED_DEMO_DATA: "true" });
    expect(result.seedDemoData).toBe(true);
  });

  it("does not accept a truthy-looking but incorrect override value", () => {
    expect(resolveSeedMode({ NODE_ENV: "production", SEED_DEMO_DATA: "1" }).seedDemoData).toBe(false);
    expect(resolveSeedMode({ NODE_ENV: "production", SEED_DEMO_DATA: "yes" }).seedDemoData).toBe(false);
    expect(resolveSeedMode({ NODE_ENV: "production", SEED_DEMO_DATA: "TRUE" }).seedDemoData).toBe(false);
  });

  it("SEED_DEMO_DATA has no effect outside production (already seeds demo data by default)", () => {
    expect(resolveSeedMode({ NODE_ENV: "development", SEED_DEMO_DATA: "false" }).seedDemoData).toBe(true);
  });
});
