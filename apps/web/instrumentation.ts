/**
 * Next.js's own server-startup hook (requires experimental.instrumentationHook
 * on 14.x — see next.config.mjs). Initializes error monitoring once when the
 * server boots, honestly reporting whether it's configured (spec §81) rather
 * than assuming Sentry is always present.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log("[web] Error monitoring: not configured (SENTRY_DSN unset).");
    return;
  }

  const Sentry = await import("@sentry/node");
  Sentry.init({ dsn, environment: process.env.NODE_ENV, tracesSampleRate: 0 });
  console.log("[web] Error monitoring: Sentry initialized.");
}
