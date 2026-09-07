import type { Instrumentation } from "next";

/**
 * Next's native error-observability hook (stable since 15.0): onRequestError
 * runs once for every uncaught error the server captures, from Server
 * Components, Route Handlers, and Server Actions alike -- somewhere every
 * such error lands in one place, which nothing in this codebase had before
 * (logger.error only fires where a call site explicitly catches and logs).
 * No Sentry SDK: that's the natural next seam here (call
 * Sentry.captureException alongside the reporting below), but pulling in a
 * full APM SDK sight-unseen, against a Next major version this new, without
 * a real DSN to verify it against, is a worse trade than a
 * dependency-free hook that already reports everywhere that matters.
 *
 * This file runs in both the Node and Edge runtime. The app's own structured
 * logger pulls in Node's `crypto` (via redactSensitive), so it's only safe
 * to import on the Node side -- the edge branch falls back to a plain
 * console.error instead of failing to bundle.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  const fields = { message, digest, path: request.path, method: request.method, routeType: context.routeType, routePath: context.routePath };

  if (process.env.NEXT_RUNTIME === "edge") {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", operation: "request.uncaught_error", ...fields }));
  } else {
    const { logger } = await import("@/lib/security/logger");
    logger.error("request.uncaught_error", fields);
  }

  const webhookUrl = process.env.ERROR_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
  } catch {
    // The error-reporting sink itself failing must never take down request
    // handling -- this is best-effort alerting, not part of the response.
  }
};
