/**
 * Structured logging + a small error-tracking abstraction.
 *
 * Every line is emitted as a single JSON object so the output is greppable and
 * machine-parseable (Vercel/Datadog/CloudWatch friendly), while still being
 * readable in a terminal. `captureError` is the single funnel for errors; its
 * sink is pluggable so a real deployment can wire in Sentry/Honeycomb/etc.
 * without touching call sites.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** JSON-serialisable context attached to a log line. */
export type LogContext = Record<string, unknown>;

let minLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

/** Convert anything thrown into a structured, serialisable shape. */
export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const out: Record<string, unknown> = {
      name: err.name,
      message: err.message,
    };
    if (err.stack !== undefined) out.stack = err.stack;
    if (err.cause !== undefined) out.cause = serializeError(err.cause);
    return out;
  }
  if (typeof err === "object" && err !== null) {
    try {
      return { value: JSON.parse(JSON.stringify(err)) as unknown };
    } catch {
