import { describe, expect, it } from "vitest";
import { deploymentTargetSchema } from "@/lib/services/deployment-targets";

describe("deploymentTargetSchema", () => {
  it("accepts a plausible customer server target", () => {
    const result = deploymentTargetSchema.safeParse({
      type: "CUSTOMER_SERVER",
      hostname: "203.0.113.10",
      port: 22,
      operatingSystem: "Ubuntu 22.04",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a domain-style hostname", () => {
    const result = deploymentTargetSchema.safeParse({ type: "CUSTOMER_SERVER", hostname: "app.customer-domain.com" });
    expect(result.success).toBe(true);
  });

  it("rejects a hostname containing a protocol (SSRF-style input)", () => {
    const result = deploymentTargetSchema.safeParse({ type: "CUSTOMER_SERVER", hostname: "http://169.254.169.254/latest/meta-data" });
    expect(result.success).toBe(false);
  });

  it("rejects a hostname containing a path or shell metacharacters", () => {
    const result = deploymentTargetSchema.safeParse({ type: "CUSTOMER_SERVER", hostname: "example.com/`rm -rf /`" });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range port", () => {
    const result = deploymentTargetSchema.safeParse({ type: "CUSTOMER_SERVER", hostname: "example.com", port: 70000 });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown target type", () => {
    const result = deploymentTargetSchema.safeParse({ type: "SOMETHING_ELSE", hostname: "example.com" });
    expect(result.success).toBe(false);
  });
});
