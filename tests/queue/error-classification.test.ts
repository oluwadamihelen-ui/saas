import { describe, expect, it } from "vitest";
import { isTransientError, DeploymentConfigurationError } from "@/lib/queue/deploymentWorker";

describe("isTransientError", () => {
  it("treats network/timeout-style errors as transient (retry)", () => {
    expect(isTransientError(new Error("Connection timeout after 30s"))).toBe(true);
    expect(isTransientError(new Error("ECONNRESET"))).toBe(true);
    expect(isTransientError(new Error("rate limit exceeded"))).toBe(true);
    expect(isTransientError(new Error("Service temporarily unavailable"))).toBe(true);
    expect(isTransientError(new Error("Request failed with status 503"))).toBe(true);
  });

  it("never treats a DeploymentConfigurationError as transient", () => {
    expect(isTransientError(new DeploymentConfigurationError("Invalid credentials"))).toBe(false);
  });

  it("treats an unrecognized error as permanent by default", () => {
    expect(isTransientError(new Error("Unsupported runtime: cobol"))).toBe(false);
    expect(isTransientError(new Error("Missing required environment variable DATABASE_URL"))).toBe(false);
  });
});
