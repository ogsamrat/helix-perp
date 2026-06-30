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

  const client = new StellarClient(config);
  const indexer = new Indexer(client, config);
  indexer.load();
  const keeper = new Keeper(client, indexer, config);

  const runOnce = process.argv.slice(2).includes("once");

  if (runOnce) {
    log.info("running single cycle (once mode)");
    await keeper.runCycle();
    indexer.save();
    log.info("once mode complete");
    return;
  }

  await runLoop(keeper, indexer, config.pollIntervalMs);
}

async function runLoop(keeper: Keeper, indexer: Indexer, intervalMs: number): Promise<void> {
  let stopping = false;
  let cycleInFlight = false;
  let timer: NodeJS.Timeout | undefined;
  let resolveDone: (() => void) | undefined;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const finish = (): void => {
    if (resolveDone) {
      resolveDone();
      resolveDone = undefined;
    }
  };

  const shutdown = (signal: string): void => {
    if (stopping) return;
    stopping = true;
    log.info("shutdown requested", { signal });
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    // If a cycle is mid-flight it owns the resolution (in tick's finally). If we
    // are idle between cycles, resolve now so the process can exit promptly.
    if (!cycleInFlight) finish();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  const tick = async (): Promise<void> => {
    cycleInFlight = true;
    try {
      await keeper.runCycle();
    } catch (err) {
      captureError(err, { scope: "runCycle" });
    } finally {
      indexer.save();
      cycleInFlight = false;
    }

    if (stopping) {
      finish();
      return;
    }
    timer = setTimeout(() => {
      void tick();
    }, intervalMs);
  };

  log.info("entering keeper loop", { intervalMs });
  void tick();
  await done;
  log.info("keeper loop stopped");
}

main().catch((err) => {
  captureError(err, { scope: "main" });
  process.exitCode = 1;
});
