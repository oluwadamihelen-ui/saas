import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRedisConnection } from "@/lib/queue/connection";
import { logger } from "@/lib/security/logger";

/**
 * Public, unauthenticated liveness/readiness check for load balancers,
 * container orchestrators, and uptime monitors -- confirms the two
 * dependencies every request path relies on (Postgres via Prisma, Redis via
 * BullMQ's connection) are actually reachable, not just that the Next.js
 * process itself is running.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; error?: string }> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    checks.database = { ok: false, error: message };
    logger.error("health.database_check_failed", { error: message });
  }

  try {
    await getRedisConnection().ping();
    checks.redis = { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    checks.redis = { ok: false, error: message };
    logger.error("health.redis_check_failed", { error: message });
  }

  const healthy = Object.values(checks).every((c) => c.ok);
  return NextResponse.json({ status: healthy ? "healthy" : "unhealthy", checks, timestamp: new Date().toISOString() }, { status: healthy ? 200 : 503 });
}
