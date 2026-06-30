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
      return { value: String(err) };
    }
  }
  return { value: String(err) };
}

/**
 * JSON.stringify replacer that makes BigInt (i128 values are common here) and
 * Error values safe to serialise instead of throwing.
 */
function replacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) return serializeError(value);
  return value;
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

  const line: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: message,
  };
  if (context !== undefined) {
    for (const [k, v] of Object.entries(context)) line[k] = v;
  }

  const serialized = JSON.stringify(line, replacer);
  // Route warn/error to stderr, the rest to stdout.
  if (level === "error" || level === "warn") {
    process.stderr.write(serialized + "\n");
  } else {
    process.stdout.write(serialized + "\n");
  }
}

export const log = {
  debug: (message: string, context?: LogContext): void => emit("debug", message, context),
  info: (message: string, context?: LogContext): void => emit("info", message, context),
  warn: (message: string, context?: LogContext): void => emit("warn", message, context),
  error: (message: string, context?: LogContext): void => emit("error", message, context),
};

/**
 * Error sink. The default implementation logs through the structured logger.
 * Swap it (e.g. for Sentry) via {@link setErrorSink} without changing callers.
 */
export type ErrorSink = (err: unknown, context: LogContext) => void;

const defaultSink: ErrorSink = (err, context) => {
  log.error("captured_error", { ...context, error: serializeError(err) });
};

let errorSink: ErrorSink = defaultSink;

export function setErrorSink(sink: ErrorSink): void {
  errorSink = sink;
}

/**
 * Single funnel for reporting errors. Never throws — safe to call from catch
 * blocks and loop bodies.
 */
export function captureError(err: unknown, context: LogContext = {}): void {
  try {
    errorSink(err, context);
  } catch (sinkErr) {
    // Last-ditch fallback if the sink itself blows up.
    try {
      process.stderr.write(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            level: "error",
            msg: "error_sink_failed",
            sinkError: serializeError(sinkErr),
            originalError: serializeError(err),
          },
          replacer,
        ) + "\n",
      );
    } catch {
      // Give up silently; we must not crash the keeper from the logger.
    }
  }
}
