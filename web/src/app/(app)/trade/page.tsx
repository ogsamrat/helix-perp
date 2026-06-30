"use client";
import { useState } from "react";
import { MarketStats } from "@/components/market/market-stats";
import { PriceChart } from "@/components/market/price-chart";
import { OrderTicket } from "@/components/trade/order-ticket";
import { PositionsTable } from "@/components/positions/positions-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveNumber } from "@/components/ui/value";
import { MARKETS, marketById } from "@/config";
import { useMarkets, usePrices } from "@/hooks/use-chain";
import { toUnits } from "@/lib/format";
import { useLiveMap } from "@/lib/ui/live-price";
import { cn } from "@/lib/utils";

function seededChange(feed: string) {
  let h = 0;
  for (let i = 0; i < feed.length; i++) h = (h * 31 + feed.charCodeAt(i)) >>> 0;
  return ((h % 600) / 100 - 3) * 1; // [-3%, +3%]
}

export default function TradePage() {
  const markets = useMarkets();
  const prices = usePrices();
  const [selectedId, setSelectedId] = useState(1);

  const live = useLiveMap();
  const meta = marketById(selectedId)!;
  const cfg = markets.data?.find((m) => m.id === selectedId);
  const priceScaled = prices.data?.[meta.feed]?.price ?? 0n;
  const onchainPrice = toUnits(priceScaled);
  // Live mark drives the chart + stats; the order ticket uses the on-chain price.
  const price = live[meta.feed] ?? onchainPrice;

  return (
    <div className="space-y-4">
      {/* market selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {MARKETS.map((m) => {
          const pUnits = live[m.feed] ?? toUnits(prices.data?.[m.feed]?.price ?? 0n);
          const chg = seededChange(m.feed);
          const active = m.id === selectedId;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={cn(
                "flex min-w-[160px] flex-col items-start gap-1 rounded-lg border px-3.5 py-2.5 text-left transition-colors",
                active ? "border-brand/40 bg-brand/5" : "border-hairline bg-surface hover:border-line",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-semibold text-ink">{m.ticker}</span>
                <Badge variant={active ? "brand" : "outline"}>{m.kind}</Badge>
              </div>
              <div className="flex w-full items-center justify-between">
                <LiveNumber value={pUnits} format={(v) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: m.priceDecimals, maximumFractionDigits: m.priceDecimals })} className="text-sm text-ink-muted" />
                <span className={cn("tnum text-2xs", chg >= 0 ? "text-long" : "text-short")}>
