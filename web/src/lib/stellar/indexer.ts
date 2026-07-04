/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * On-chain leaderboard indexer.
 *
 * Pages `getEvents` over the perp_engine contract across the RPC's retained
 * history window and folds the raw trade events into per-trader statistics and
 * protocol-wide totals. Everything here is derived from real on-chain events —
 * no backend database, no synthetic data.
 *
 *   position_opened      -> volume += notional, trades += 1
 *   position_closed      -> realizedPnl += realized_pnl, wins += (pnl > 0)
 *   position_liquidated  -> liquidations += 1
 *
 * Trader address is the first indexed topic on each event.
 */

import { scValToNative, xdr } from "@stellar/stellar-sdk";
import { CONFIG } from "@/config";
import { server } from "./client";

export interface TraderRow {
  address: string;
  /** Sum of opened notional, 7-dp USDC. */
  volume: bigint;
  /** Sum of realized PnL on closes, 7-dp USDC (net of fees + funding). */
  realizedPnl: bigint;
  /** Number of positions opened. */
  trades: number;
  /** Closes that finished in profit. */
  wins: number;
  /** Number of positions closed. */
  closed: number;
  /** Times this trader was liquidated. */
  liquidations: number;
}

export interface ProtocolStats {
  volume: bigint;
  trades: number;
  traders: number;
  closed: number;
  liquidations: number;
  netPnl: bigint;
  latestLedger: number;
}

export interface LeaderboardData {
  rows: TraderRow[];
  stats: ProtocolStats;
}

const EVENTS_PAGE_LIMIT = 200;
const MAX_PAGES = 40;
/**
 * Testnet RPC only retains a rolling event window (~10–14h). A startLedger set
 * *before* retention returns empty (not an error), so we probe from the largest
 * safe window down until events appear, then page forward by cursor.
 */
const LOOKBACK_WINDOWS = [9_000, 6_000, 3_000, 1_500];

function normName(topic: xdr.ScVal | undefined): string {
  if (!topic) return "";
  try {
    return String(scValToNative(topic)).replace(/[^a-z0-9]/gi, "").toLowerCase();
  } catch {
    return "";
  }
}

function addrTopic(topics: xdr.ScVal[]): string | undefined {
  const t = topics[1];
  if (!t) return undefined;
  try {
    const v = scValToNative(t);
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

function body(value: xdr.ScVal): Record<string, any> {
  try {
    const v = scValToNative(value);
    return v && typeof v === "object" ? (v as Record<string, any>) : {};
  } catch {
    return {};
  }
}

function toBig(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.round(v));
  if (typeof v === "string" && /^-?\d+$/.test(v)) return BigInt(v);
  return 0n;
}

function emptyRow(address: string): TraderRow {
  return { address, volume: 0n, realizedPnl: 0n, trades: 0, wins: 0, closed: 0, liquidations: 0 };
}

/**
 * Build the leaderboard by streaming engine events. Read-only (simulation-free
 * `getEvents`), safe to call from the browser.
 */
export async function fetchLeaderboard(): Promise<LeaderboardData> {
  const latest = await server.getLatestLedger();

  const rows = new Map<string, TraderRow>();
  const row = (addr: string): TraderRow => {
    let r = rows.get(addr);
    if (!r) {
      r = emptyRow(addr);
      rows.set(addr, r);
    }
    return r;
  };

  const stats: ProtocolStats = {
    volume: 0n,
    trades: 0,
    traders: 0,
    closed: 0,
    liquidations: 0,
    netPnl: 0n,
    latestLedger: latest.sequence,
  };

  const filters = [{ type: "contract" as const, contractIds: [CONFIG.contracts.perpEngine] }];
  const ingest = (events: any[]) => {
    for (const e of events) {
      const topics: xdr.ScVal[] = e.topic ?? [];
      const name = normName(topics[0]);
      const trader = addrTopic(topics);
      if (!trader) continue;
      const d = body(e.value);

      if (name === "positionopened") {
        const r = row(trader);
        r.volume += toBig(d.notional);
        r.trades += 1;
        stats.volume += toBig(d.notional);
        stats.trades += 1;
      } else if (name === "positionclosed") {
        const r = row(trader);
        const pnl = toBig(d.realized_pnl);
        r.realizedPnl += pnl;
        r.closed += 1;
        if (pnl > 0n) r.wins += 1;
        stats.closed += 1;
        stats.netPnl += pnl;
      } else if (name === "positionliquidated") {
        const r = row(trader);
        r.liquidations += 1;
        stats.liquidations += 1;
      }
    }
  };

  // Probe from the largest safe window down until the first page has events.
  let cursor: string | undefined;
  let started = false;
  for (const look of LOOKBACK_WINDOWS) {
    const startLedger = Math.max(1, latest.sequence - look);
    try {
      const res: any = await server.getEvents({ startLedger, filters, limit: EVENTS_PAGE_LIMIT } as any);
      const events: any[] = res.events ?? [];
      if (events.length > 0) {
        ingest(events);
        cursor = res.cursor;
        started = events.length >= EVENTS_PAGE_LIMIT;
        break;
      }
    } catch {
      /* window outside retention — try a smaller one */
    }
  }

  // Continue forward by cursor until the backlog drains.
  for (let page = 0; started && cursor && page < MAX_PAGES; page++) {
    let res: any;
    try {
      res = await server.getEvents({ filters, cursor, limit: EVENTS_PAGE_LIMIT } as any);
    } catch {
      break;
    }
    const events: any[] = res.events ?? [];
    ingest(events);
    cursor = res.cursor;
    if (events.length < EVENTS_PAGE_LIMIT) break;
  }

  stats.traders = rows.size;

  const ranked = [...rows.values()].sort((a, b) => {
    if (a.realizedPnl !== b.realizedPnl) return a.realizedPnl > b.realizedPnl ? -1 : 1;
    return a.volume > b.volume ? -1 : a.volume < b.volume ? 1 : 0;
  });

  return { rows: ranked, stats };
}
