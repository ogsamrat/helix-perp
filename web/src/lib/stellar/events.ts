/* eslint-disable @typescript-eslint/no-explicit-any */
import { scValToNative } from "@stellar/stellar-sdk";
import { CONFIG } from "@/config";
import { server } from "./client";
import type { ChainEvent } from "./types";

const WATCHED = [CONFIG.contracts.perpEngine, CONFIG.contracts.collateralVault];

const TYPE_MAP: Record<string, ChainEvent["type"]> = {
  positionopened: "PositionOpened",
  positionclosed: "PositionClosed",
  positionmodified: "PositionModified",
  positionliquidated: "PositionLiquidated",
  fundingupdated: "FundingUpdated",
  liquidityadded: "LiquidityAdded",
  liquidityremoved: "LiquidityRemoved",
  marginlocked: "MarginLocked",
  settled: "Settled",
};

function normName(s: string): ChainEvent["type"] {
  const key = s.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return TYPE_MAP[key] ?? "Unknown";
}

function safeNative(v: unknown): unknown {
  try {
    return scValToNative(v as any);
  } catch {
    return undefined;
  }
}

export interface EventsPage {
  events: ChainEvent[];
  latestLedger: number;
}

/**
 * Poll recent contract events (lightweight on-chain indexer). `sinceLedger`
 * lets the activity feed page forward without re-reading the whole window.
 */
export async function fetchEvents(sinceLedger?: number, limit = 100): Promise<EventsPage> {
  const latest = await server.getLatestLedger();
  // Testnet RPC only retains a rolling window (~10-14h). A startLedger set
  // *before* retention returns empty, so stay well inside it (~11h at 5s ledgers).
  const fallback = Math.max(latest.sequence - 8000, 1);
  const startLedger = sinceLedger && sinceLedger > fallback ? sinceLedger : fallback;

  let res: any;
  try {
    res = await server.getEvents({
      startLedger,
      filters: WATCHED.map((id) => ({ type: "contract", contractIds: [id], topics: [] })),
      limit,
    } as any);
  } catch {
    return { events: [], latestLedger: latest.sequence };
  }

  const events: ChainEvent[] = (res.events ?? []).map((e: any) => {
    const topics: string[] = (e.topic ?? []).map((t: any) => String(safeNative(t)));
    const data = safeNative(e.value);
    const ts = e.ledgerClosedAt ? Math.floor(Date.parse(e.ledgerClosedAt) / 1000) : 0;
    return {
      id: e.id ?? `${e.ledger}-${e.pagingToken ?? Math.random()}`,
      type: normName(topics[0] ?? ""),
      ledger: Number(e.ledger ?? 0),
      txHash: e.txHash ?? "",
      ts,
      contractId: e.contractId?.toString?.() ?? String(e.contractId ?? ""),
      topics: topics.slice(1),
      data: (data && typeof data === "object" ? (data as Record<string, unknown>) : { value: data }) ?? {},
    };
  });

  // newest first
  events.reverse();
  return { events, latestLedger: res.latestLedger ?? latest.sequence };
}
