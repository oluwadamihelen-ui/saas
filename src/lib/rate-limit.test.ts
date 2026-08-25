import { describe, it, expect, vi, afterEach } from "vitest";
import { rateLimit, requestKey } from "./rate-limit";
import { randomUUID } from "node:crypto";

describe("rateLimit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit and blocks the next one", () => {
    const key = `test:${randomUUID()}`;
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(false);
  });

  it("keeps buckets independent per key", () => {
    const keyA = `test:${randomUUID()}`;
    const keyB = `test:${randomUUID()}`;
    expect(rateLimit(keyA, 1, 60_000)).toBe(true);
    expect(rateLimit(keyA, 1, 60_000)).toBe(false);
    expect(rateLimit(keyB, 1, 60_000)).toBe(true);
  });

  it("resets the window after it elapses", () => {
    vi.useFakeTimers();
    const key = `test:${randomUUID()}`;
    expect(rateLimit(key, 1, 1000)).toBe(true);
    expect(rateLimit(key, 1, 1000)).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(rateLimit(key, 1, 1000)).toBe(true);
  });
});

describe("requestKey", () => {
  it("prefers x-forwarded-for, taking the first IP in the list", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(requestKey(req, "scope")).toBe("scope:1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = new Request("http://localhost", { headers: { "x-real-ip": "9.9.9.9" } });
    expect(requestKey(req, "scope")).toBe("scope:9.9.9.9");
  });

  it("falls back to unknown when no IP headers are present", () => {
    const req = new Request("http://localhost");
    expect(requestKey(req, "scope")).toBe("scope:unknown");
  });
});
