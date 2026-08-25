// Minimal structured logger. Emits one JSON line per call so log
// aggregators (or plain grep) can filter by level/scope/fields — swap the
// transport here for a real provider (Datadog, Axiom, etc.) later without
// touching call sites.

type LogFields = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", scope: string, message: string, fields?: LogFields) {
  const line = {
    level,
    scope,
    message,
    time: new Date().toISOString(),
    ...fields,
  };

  const serialized = JSON.stringify(line, (_key, value) => (value instanceof Error ? serializeError(value) : value));

  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

function serializeError(err: Error) {
  return { name: err.name, message: err.message, stack: err.stack };
}

/** scope() gives every call site a consistent tag (e.g. "pipeline.render", "webhook.stripe") without repeating it. */
export function createLogger(scope: string) {
  return {
    info: (message: string, fields?: LogFields) => emit("info", scope, message, fields),
    warn: (message: string, fields?: LogFields) => emit("warn", scope, message, fields),
    error: (message: string, fields?: LogFields) => emit("error", scope, message, fields),
  };
}
