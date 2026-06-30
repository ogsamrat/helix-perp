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
