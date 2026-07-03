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
  const selChg = seededChange(meta.feed);

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
                "focus-ring flex min-w-[150px] flex-col items-start gap-1.5 rounded-xl border px-4 py-3 text-left transition-colors sm:min-w-[172px]",
                active
                  ? "border-ink/25 bg-elevated"
                  : "border-hairline bg-surface hover:border-line",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-semibold tracking-tight text-ink">{m.ticker}</span>
                <Badge variant={active ? "neutral" : "outline"}>{m.kind}</Badge>
              </div>
              <div className="flex w-full items-center justify-between">
                <LiveNumber value={pUnits} format={(v) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: m.priceDecimals, maximumFractionDigits: m.priceDecimals })} className="text-sm text-ink-muted" />
                <span className={cn("tnum text-2xs", chg >= 0 ? "text-long" : "text-short")}>
                  {chg >= 0 ? "+" : ""}
                  {chg.toFixed(2)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {cfg ? <MarketStats meta={meta} cfg={cfg} price={price} /> : <Skeleton className="h-16 w-full" />}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-baseline gap-2.5">
                <span className="font-display text-xl tracking-tight text-ink">{meta.ticker}</span>
                <span className="text-xs text-ink-faint">{meta.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <LiveNumber
                  value={price}
                  format={(v) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: meta.priceDecimals, maximumFractionDigits: meta.priceDecimals })}
                  className="text-base font-medium text-ink"
                />
                <span className={cn("tnum text-xs", selChg >= 0 ? "text-long" : "text-short")}>
                  {selChg >= 0 ? "+" : ""}
                  {selChg.toFixed(2)}%
                </span>
                <span className="hidden text-2xs text-ink-faint sm:inline">Reflector · {meta.feed}</span>
              </div>
            </CardHeader>
            <div className="h-[380px] w-full p-2">
              {price > 0 ? (
                <PriceChart feed={meta.feed} price={price} decimals={meta.priceDecimals} />
              ) : (
                <Skeleton className="h-full w-full" />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Positions</CardTitle>
            </CardHeader>
            <PositionsTable />
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-[72px]">
            <CardHeader>
              <CardTitle>Order</CardTitle>
              <span className="text-2xs text-ink-faint">Market · {meta.ticker}</span>
            </CardHeader>
            <CardBody>
              {cfg ? (
                <OrderTicket meta={meta} cfg={cfg} price={onchainPrice} />
              ) : (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
