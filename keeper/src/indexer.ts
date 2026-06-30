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
      for (const idStr of parsed.openPositionIds) {
        try {
          this.openIds.add(BigInt(idStr));
        } catch {
          // skip non-numeric ids
        }
      }
      log.info("indexer state loaded", {
        cursor: this.cursor,
        openCount: this.openIds.size,
        lastLedger: this.lastLedger,
      });
    } catch {
      log.info("no prior indexer state; starting cold", { path: this.config.statePath });
    }
  }

  /** Atomically persist current state to disk. */
  save(): void {
    const state: PersistedState = {
      cursor: this.cursor,
      openPositionIds: [...this.openIds].map((id) => id.toString()),
      lastLedger: this.lastLedger,
      updatedAt: new Date().toISOString(),
    };
    try {
      const tmp = `${this.config.statePath}.tmp`;
      writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
      renameSync(tmp, this.config.statePath);
    } catch (err) {
      captureError(err, { scope: "indexer.save", path: this.config.statePath });
    }
  }

  /** Snapshot of currently-open position ids. */
  openPositionIds(): bigint[] {
    return [...this.openIds];
  }

  /**
   * Pull all new events since the last cursor and fold them into the open-id
   * set. On a cold start (no cursor) we begin `eventLookbackLedgers` before the
   * latest ledger, clamped to the RPC's retained history.
   */
  async sync(): Promise<void> {
    let pages = 0;
    while (pages < MAX_PAGES_PER_CYCLE) {
      pages++;
      const request = await this.buildRequest();
      let resp: rpc.Api.GetEventsResponse;
      try {
        resp = await this.client.server.getEvents(request);
      } catch (err) {
        // A stale cursor (outside retention) is the common failure: reset to a
        // ledger-range start so the next attempt recovers.
        captureError(err, { scope: "indexer.getEvents", hadCursor: this.cursor !== null });
        if (this.cursor !== null) {
          log.warn("resetting indexer cursor after getEvents failure");
          this.cursor = null;
        }
        return;
      }

      for (const event of resp.events) {
        this.applyEvent(event);
      }

      // Advance the cursor so the next page/cycle continues forward.
      if (resp.cursor) this.cursor = resp.cursor;

      // Fewer than a full page means we've drained the backlog for now.
      if (resp.events.length < EVENTS_PAGE_LIMIT) break;
    }

    this.save();
  }

  private async buildRequest(): Promise<rpc.Api.GetEventsRequest> {
    const filters: rpc.Api.EventFilter[] = [
      {
        type: "contract",
