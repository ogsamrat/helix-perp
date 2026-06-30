"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ArrowDownRight, ArrowUpRight, Coins, Percent, Radio, Zap } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { explorerTx, marketById } from "@/config";
import { useEvents } from "@/hooks/use-chain";
import { fmtUsd, shortAddr, timeAgo } from "@/lib/format";
import { tagOf } from "@/lib/stellar/scval";
import type { ChainEvent } from "@/lib/stellar/types";

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Trades", value: "trades" },
  { label: "Liquidations", value: "liq" },
  { label: "Funding", value: "funding" },
  { label: "Liquidity", value: "lp" },
] as const;

function num(data: any, ...keys: string[]): bigint | undefined {
  for (const k of keys) if (data?.[k] !== undefined) try { return BigInt(data[k]); } catch { /* */ }
  return undefined;
}

function iconFor(t: ChainEvent["type"]) {
  switch (t) {
    case "PositionOpened":
      return <ArrowUpRight className="h-4 w-4 text-long" />;
    case "PositionClosed":
      return <ArrowDownRight className="h-4 w-4 text-ink-muted" />;
    case "PositionLiquidated":
      return <Zap className="h-4 w-4 text-short" />;
    case "FundingUpdated":
      return <Percent className="h-4 w-4 text-brand" />;
    case "LiquidityAdded":
    case "LiquidityRemoved":
    case "MarginLocked":
    case "Settled":
      return <Coins className="h-4 w-4 text-ink-muted" />;
    default:
      return <Radio className="h-4 w-4 text-ink-faint" />;
  }
}

function describe(e: ChainEvent): { title: string; detail: string } {
  const mid = Number(e.topics?.[1] ?? (e.data as any)?.market_id ?? 0);
  const tk = marketById(mid)?.ticker ?? (mid ? `Market ${mid}` : "");
