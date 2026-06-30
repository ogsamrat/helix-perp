/**
 * Lightweight on-chain indexer.
 *
 * Polls `rpc.Server.getEvents` for the perp_engine contract and maintains an
 * in-memory Set of open position ids:
 *   - `position_opened`     -> add id
 *   - `position_closed`     -> remove id
 *   - `position_liquidated` -> remove id
 *
 * The last-seen paging cursor and the open-id set are persisted to
 * `keeper/state.json` so restarts resume where they left off instead of
 * re-scanning (and the RPC only retains a bounded event-history window).
 *
 * Event-name note: the contracts declare events with soroban-sdk's
 * `#[contractevent]`, whose default topic name is the struct name in
 * snake_case (`PositionOpened` -> `position_opened`). We match snake_case and
 * also accept the PascalCase spelling defensively.
 */

import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { scValToNative, xdr } from "@stellar/stellar-sdk";
import type { rpc } from "@stellar/stellar-sdk";
import type { StellarClient } from "./stellar.js";
import type { KeeperConfig } from "./config.js";
import { captureError, log } from "./logger.js";

const OPEN_EVENTS = new Set(["position_opened", "PositionOpened"]);
const CLOSE_EVENTS = new Set([
  "position_closed",
  "PositionClosed",
  "position_liquidated",
  "PositionLiquidated",
]);

/** Max events to fetch per getEvents page (RPC hard cap is 10_000). */
const EVENTS_PAGE_LIMIT = 200;
/** Safety bound on pages per cycle so a huge backlog can't wedge a cycle. */
const MAX_PAGES_PER_CYCLE = 50;

interface PersistedState {
  /** RPC paging cursor of the last consumed event. */
  cursor: string | null;
  /** Open position ids as strings (u64 may exceed Number.MAX_SAFE_INTEGER). */
  openPositionIds: string[];
  /** Last ledger we observed an event in (diagnostic only). */
  lastLedger: number;
  updatedAt: string;
}

function isPersistedState(value: unknown): value is PersistedState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const cursorOk = v.cursor === null || typeof v.cursor === "string";
  const idsOk =
    Array.isArray(v.openPositionIds) && v.openPositionIds.every((x) => typeof x === "string");
  return cursorOk && idsOk;
}

export class Indexer {
  private cursor: string | null = null;
  private lastLedger = 0;
  private readonly openIds = new Set<bigint>();

  constructor(
    private readonly client: StellarClient,
    private readonly config: KeeperConfig,
  ) {}

  /** Load persisted state from disk (no-op if absent/corrupt). */
  load(): void {
    try {
      const raw = readFileSync(this.config.statePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!isPersistedState(parsed)) {
        log.warn("state.json present but malformed; ignoring", { path: this.config.statePath });
        return;
      }
      this.cursor = parsed.cursor;
      this.lastLedger = typeof parsed.lastLedger === "number" ? parsed.lastLedger : 0;
      this.openIds.clear();
