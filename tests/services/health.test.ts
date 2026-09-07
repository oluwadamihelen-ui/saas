import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("reports healthy when the database and Redis are both reachable", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("healthy");
    expect(json.checks.database.ok).toBe(true);
    expect(json.checks.redis.ok).toBe(true);
    expect(typeof json.timestamp).toBe("string");
  });
});
