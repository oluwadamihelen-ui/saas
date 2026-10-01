import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "http";
import type { AddressInfo } from "net";
import { S3Storage, s3ConfigFromEnv } from "@/lib/storage/s3";
import { SAFE_KEY } from "@/lib/storage";

/** A tiny in-memory S3 look-alike (path-style PUT/GET/DELETE) so the real AWS SDK + SigV4 path is exercised. */
let server: http.Server;
let base = "";
const store = new Map<string, { body: Buffer; type: string }>();
const seen: { method: string; auth: string; type: string }[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const key = decodeURIComponent((req.url ?? "").split("?")[0]);
      seen.push({ method: req.method ?? "", auth: String(req.headers.authorization ?? ""), type: String(req.headers["content-type"] ?? "") });
      if (req.method === "PUT") { store.set(key, { body: Buffer.concat(chunks), type: String(req.headers["content-type"]) }); res.writeHead(200, { ETag: '"x"' }).end(); }
      else if (req.method === "GET") {
        const o = store.get(key);
        if (!o) { res.writeHead(404, { "Content-Type": "application/xml" }).end("<Error><Code>NoSuchKey</Code></Error>"); return; }
        res.writeHead(200, { "Content-Type": o.type, "Content-Length": o.body.length }).end(o.body);
      } else if (req.method === "DELETE") { store.delete(key); res.writeHead(204).end(); }
      else res.writeHead(405).end();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("S3Storage (S3-compatible)", () => {
  const mk = () => new S3Storage({ bucket: "shots", endpoint: base, region: "auto", accessKeyId: "AKIATEST", secretAccessKey: "secret", forcePathStyle: true });

  it("puts, gets and deletes objects with SigV4-signed requests", async () => {
    const s = mk();
    const data = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5]);
    await s.put("user1/trade1/abc.png", data, "image/png");
    expect(store.get("/shots/user1/trade1/abc.png")?.body.equals(data)).toBe(true);
    expect(store.get("/shots/user1/trade1/abc.png")?.type).toBe("image/png");
    expect((await s.get("user1/trade1/abc.png")).equals(data)).toBe(true);
    await s.delete("user1/trade1/abc.png");
    expect(store.size).toBe(0);
    expect(seen.every((x) => x.auth.startsWith("AWS4-HMAC-SHA256 Credential=AKIATEST/"))).toBe(true);
  });
  it("throws when the object is missing", async () => {
    await expect(mk().get("nobody/none/x.png")).rejects.toThrow();
  });
});

describe("config & key safety", () => {
  const env = { STORAGE_BUCKET: "b", STORAGE_ACCESS_KEY_ID: "a", STORAGE_SECRET_ACCESS_KEY: "s" } as unknown as NodeJS.ProcessEnv;
  it("requires credentials and an endpoint for R2", () => {
    expect(() => s3ConfigFromEnv("s3", {} as NodeJS.ProcessEnv)).toThrow(/STORAGE_BUCKET/);
    expect(() => s3ConfigFromEnv("r2", env)).toThrow(/STORAGE_ENDPOINT/);
    expect(s3ConfigFromEnv("r2", { ...env, STORAGE_ENDPOINT: "https://x.r2.cloudflarestorage.com" } as unknown as NodeJS.ProcessEnv).region).toBe("auto");
    expect(s3ConfigFromEnv("s3", env).region).toBe("us-east-1");
  });
  it("accepts generated keys and rejects traversal / odd keys", () => {
    expect(SAFE_KEY.test("cmu123/cmt456/0b1c-2d3e.png")).toBe(true);
    for (const bad of ["../etc/passwd", "a/../b.png", "/abs.png", "a//b.png", "a/b", "a/b.png?x=1", "a b/c.png", "a/b.exe;rm"]) expect(SAFE_KEY.test(bad)).toBe(false);
  });
});
