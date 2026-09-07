import { redactSensitive } from "./encryption";

type LogFields = Record<string, unknown>;

function emit(level: "debug" | "info" | "warn" | "error", operation: string, fields: LogFields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    operation,
    ...(redactSensitive(fields) as LogFields),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (operation: string, fields?: LogFields) => emit("debug", operation, fields),
  info: (operation: string, fields?: LogFields) => emit("info", operation, fields),
  warn: (operation: string, fields?: LogFields) => emit("warn", operation, fields),
  error: (operation: string, fields?: LogFields) => emit("error", operation, fields),
};
