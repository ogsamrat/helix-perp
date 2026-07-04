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
const ORDER_OPEN_EVENTS = new Set(["order_placed", "OrderPlaced"]);
const ORDER_CLOSE_EVENTS = new Set([
  "order_filled",
  "OrderFilled",
  "order_cancelled",
  "OrderCancelled",
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
  /** Resting (unfilled) conditional order ids as strings. */
  openOrderIds?: string[];
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
  private readonly orderIds = new Set<bigint>();

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
      this.orderIds.clear();
      for (const idStr of parsed.openOrderIds ?? []) {
        try {
          this.orderIds.add(BigInt(idStr));
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
      openOrderIds: [...this.orderIds].map((id) => id.toString()),
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

  /** Snapshot of resting (unfilled) conditional order ids. */
  openOrderIds(): bigint[] {
    return [...this.orderIds];
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
        contractIds: [this.config.perpEngineId],
      },
    ];

    if (this.cursor !== null) {
      // Cursor mode: startLedger/endLedger must be omitted.
      return { filters, cursor: this.cursor, limit: EVENTS_PAGE_LIMIT };
    }

    // Ledger-range mode (cold start): begin lookback before the latest ledger.
    const latest = await this.client.getLatestLedger();
    const startLedger = Math.max(1, latest - this.config.eventLookbackLedgers);
    log.info("indexer cold start", { startLedger, latest });
    return { filters, startLedger, limit: EVENTS_PAGE_LIMIT };
  }

  private applyEvent(event: rpc.Api.EventResponse): void {
    const name = this.eventName(event.topic);
    if (name === undefined) return;

    if (event.ledger > this.lastLedger) this.lastLedger = event.ledger;

    // Conditional-order lifecycle (id lives in the event body, like positions).
    const isOrderOpen = ORDER_OPEN_EVENTS.has(name);
    const isOrderClose = ORDER_CLOSE_EVENTS.has(name);
    if (isOrderOpen || isOrderClose) {
      const oid = this.extractPositionId(event.value);
      if (oid === undefined) return;
      if (isOrderOpen) this.orderIds.add(oid);
      else this.orderIds.delete(oid);
      log.debug("order tracked", { id: oid.toString(), name, ledger: event.ledger });
      return;
    }

    const isOpen = OPEN_EVENTS.has(name);
    const isClose = CLOSE_EVENTS.has(name);
    if (!isOpen && !isClose) return;

    const id = this.extractPositionId(event.value);
    if (id === undefined) {
      log.warn("could not extract position id from event", { name, ledger: event.ledger });
      return;
    }

    if (isOpen) {
      this.openIds.add(id);
      log.debug("position opened", { id: id.toString(), ledger: event.ledger });
    } else {
      this.openIds.delete(id);
      log.debug("position removed", { id: id.toString(), name, ledger: event.ledger });
    }
  }

  /** First topic is the event-name symbol. */
  private eventName(topics: xdr.ScVal[]): string | undefined {
    const first = topics[0];
    if (first === undefined) return undefined;
    try {
      const native = scValToNative(first);
      return typeof native === "string" ? native : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Extract the `id` (u64) from the event body. The engine events carry `id` as
   * a non-topic field, so it lives inside the event `value` map/struct. We also
   * tolerate a bare scalar value, just in case.
   */
  private extractPositionId(value: xdr.ScVal): bigint | undefined {
    let native: unknown;
    try {
      native = scValToNative(value);
    } catch {
      return undefined;
    }
    return coercePositionId(native);
  }
}

function coercePositionId(native: unknown): bigint | undefined {
  if (typeof native === "bigint") return native;
  if (typeof native === "number" && Number.isInteger(native)) return BigInt(native);
  if (typeof native === "object" && native !== null) {
    const rec = native as Record<string, unknown>;
    const raw = rec.id;
    if (typeof raw === "bigint") return raw;
    if (typeof raw === "number" && Number.isInteger(raw)) return BigInt(raw);
    if (typeof raw === "string" && /^\d+$/.test(raw)) return BigInt(raw);
  }
  return undefined;
}
