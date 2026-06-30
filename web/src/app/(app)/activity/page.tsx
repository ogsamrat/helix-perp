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
  const d = e.data as any;
  switch (e.type) {
    case "PositionOpened": {
      const side = tagOf(d?.side);
      const n = num(d, "notional");
      return { title: `Opened ${side} ${tk}`.trim(), detail: n !== undefined ? fmtUsd(n) : "" };
    }
    case "PositionClosed": {
      const pl = num(d, "realized_pnl");
      return { title: `Closed ${tk}`.trim(), detail: pl !== undefined ? `PnL ${fmtUsd(pl)}` : "" };
    }
    case "PositionLiquidated":
      return { title: `Liquidated ${tk}`.trim(), detail: "maintenance breached" };
    case "FundingUpdated": {
      const r = num(d, "rate_bps");
      return { title: `Funding · ${tk}`.trim(), detail: r !== undefined ? `${Number(r) / 100}%/period` : "" };
    }
    case "LiquidityAdded":
      return { title: "Liquidity added", detail: num(d, "amount") !== undefined ? fmtUsd(num(d, "amount")!) : "" };
    case "LiquidityRemoved":
      return { title: "Liquidity removed", detail: num(d, "amount") !== undefined ? fmtUsd(num(d, "amount")!) : "" };
    case "MarginLocked":
      return { title: "Margin locked", detail: num(d, "margin") !== undefined ? fmtUsd(num(d, "margin")!) : "" };
    case "Settled":
      return { title: "Position settled", detail: num(d, "payout") !== undefined ? `payout ${fmtUsd(num(d, "payout")!)}` : "" };
    default:
      return { title: "Event", detail: "" };
  }
}

function matches(e: ChainEvent, f: string): boolean {
  if (f === "all") return true;
  if (f === "trades") return e.type === "PositionOpened" || e.type === "PositionClosed" || e.type === "PositionModified";
  if (f === "liq") return e.type === "PositionLiquidated";
  if (f === "funding") return e.type === "FundingUpdated";
  if (f === "lp") return e.type === "LiquidityAdded" || e.type === "LiquidityRemoved";
  return true;
}

export default function ActivityPage() {
  const { data, isLoading } = useEvents();
  const [filter, setFilter] = useState<string>("all");
  const events = (data?.events ?? []).filter((e) => e.type !== "Unknown" && matches(e, filter));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">Activity</h1>
          <p className="text-sm text-ink-muted">Live on-chain events from the protocol, straight off Soroban RPC.</p>
        </div>
        <div className="flex items-center gap-2 text-2xs text-ink-faint">
