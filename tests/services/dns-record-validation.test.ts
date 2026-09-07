import { describe, expect, it } from "vitest";
import { dnsRecordSchema } from "@/lib/services/dns-records";

describe("dnsRecordSchema", () => {
  it("accepts a valid A record", () => {
    const result = dnsRecordSchema.safeParse({ type: "A", name: "@", value: "203.0.113.10" });
    expect(result.success).toBe(true);
  });

  it("rejects an A record with a non-IPv4 value", () => {
    const result = dnsRecordSchema.safeParse({ type: "A", name: "@", value: "not-an-ip" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid AAAA record", () => {
    const result = dnsRecordSchema.safeParse({ type: "AAAA", name: "@", value: "2606:4700:4700::1111" });
    expect(result.success).toBe(true);
  });

  it("rejects an AAAA record given an IPv4 address", () => {
    const result = dnsRecordSchema.safeParse({ type: "AAAA", name: "@", value: "203.0.113.10" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid CNAME record", () => {
    const result = dnsRecordSchema.safeParse({ type: "CNAME", name: "www", value: "example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects an MX record without a priority", () => {
    const result = dnsRecordSchema.safeParse({ type: "MX", name: "@", value: "mail.example.com" });
    expect(result.success).toBe(false);
  });

  it("accepts an MX record with a priority", () => {
    const result = dnsRecordSchema.safeParse({ type: "MX", name: "@", value: "mail.example.com", priority: 10 });
    expect(result.success).toBe(true);
  });

  it("accepts a TXT record with arbitrary text", () => {
    const result = dnsRecordSchema.safeParse({ type: "TXT", name: "@", value: "v=spf1 include:_spf.example.com ~all" });
    expect(result.success).toBe(true);
  });

  it("rejects a record name containing invalid characters", () => {
    const result = dnsRecordSchema.safeParse({ type: "A", name: "not valid!", value: "203.0.113.10" });
    expect(result.success).toBe(false);
  });

  it("defaults ttl to 3600 when omitted", () => {
    const result = dnsRecordSchema.safeParse({ type: "A", name: "@", value: "203.0.113.10" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ttl).toBe(3600);
  });

  it("rejects a ttl outside the allowed range", () => {
    const result = dnsRecordSchema.safeParse({ type: "A", name: "@", value: "203.0.113.10", ttl: 10 });
    expect(result.success).toBe(false);
  });
});
