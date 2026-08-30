import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { TenantError } from "@/lib/errors";

export function apiError(err: unknown): NextResponse {
  if (err instanceof TenantError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", issues: err.flatten() },
      { status: 400 }
    );
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

/** Simple in-memory rate limiter — fine for a single-instance MVP deployment. */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
