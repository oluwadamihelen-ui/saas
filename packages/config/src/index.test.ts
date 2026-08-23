import { beforeEach, describe, expect, it } from "vitest";
import { isProviderConfigured, loadEnv, resetEnvCacheForTests } from "./index.js";

const REQUIRED_ENV = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  STORAGE_BUCKET: "bucket",
  STORAGE_ACCESS_KEY_ID: "key",
  STORAGE_SECRET_ACCESS_KEY: "secret",
  AUTH_SECRET: "a".repeat(32),
};

beforeEach(() => {
  resetEnvCacheForTests();
});

describe("loadEnv", () => {
  it("parses a minimal valid environment", () => {
    const env = loadEnv(REQUIRED_ENV as unknown as NodeJS.ProcessEnv);
    expect(env.DATABASE_URL).toBe(REQUIRED_ENV.DATABASE_URL);
    expect(env.NODE_ENV).toBe("development");
  });

  it("throws a descriptive error when a required variable is missing", () => {
    const { DATABASE_URL, ...withoutDb } = REQUIRED_ENV;
    void DATABASE_URL;
    expect(() => loadEnv(withoutDb as unknown as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
  });
});

describe("isProviderConfigured", () => {
  it("reports a provider as not configured when its key is absent", () => {
    const env = loadEnv(REQUIRED_ENV as unknown as NodeJS.ProcessEnv);
    expect(isProviderConfigured.anthropic(env)).toBe(false);
  });

  it("reports a provider as configured once its key is present", () => {
    const env = loadEnv({ ...REQUIRED_ENV, ANTHROPIC_API_KEY: "sk-ant-test" } as unknown as NodeJS.ProcessEnv);
    expect(isProviderConfigured.anthropic(env)).toBe(true);
  });

  it("reports Sentry as configured once SENTRY_DSN is present", () => {
    const withoutSentry = loadEnv(REQUIRED_ENV as unknown as NodeJS.ProcessEnv);
    expect(isProviderConfigured.sentry(withoutSentry)).toBe(false);

    resetEnvCacheForTests();
    const withSentry = loadEnv({ ...REQUIRED_ENV, SENTRY_DSN: "https://key@sentry.io/1" } as unknown as NodeJS.ProcessEnv);
    expect(isProviderConfigured.sentry(withSentry)).toBe(true);
  });
});
