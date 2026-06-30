/**
 * Keeper entrypoint.
 *
 *   tsx src/index.ts        -> loop forever every POLL_INTERVAL_MS
 *   tsx src/index.ts once    -> run a single cycle then exit (Vercel Cron / CI)
 *
 * The loop is self-scheduling (setTimeout after each cycle finishes) rather
 * than setInterval, so cycles never overlap if one runs long. SIGINT/SIGTERM
 * trigger a graceful shutdown: stop scheduling, let any in-flight cycle finish,
 * persist state, then exit.
 */

import { loadConfig, redactedConfig } from "./config.js";
import { setLogLevel, log, captureError } from "./logger.js";
import type { LogLevel } from "./logger.js";
import { StellarClient } from "./stellar.js";
import { Indexer } from "./indexer.js";
import { Keeper } from "./keeper.js";

function parseLogLevel(value: string | undefined): LogLevel {
  switch ((value ?? "").toLowerCase()) {
    case "debug":
      return "debug";
    case "warn":
      return "warn";
    case "error":
      return "error";
    case "info":
    case "":
      return "info";
    default:
      return "info";
  }
}

async function main(): Promise<void> {
  setLogLevel(parseLogLevel(process.env.LOG_LEVEL));

  const config = loadConfig();
  log.info("helix keeper starting", redactedConfig(config));
