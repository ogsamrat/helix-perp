"use client";
import { useMarketOi } from "@/hooks/use-chain";
import { fmtCompactUsd, fmtPrice, toUnits } from "@/lib/format";
import type { MarketMeta } from "@/config";
import type { MarketConfig } from "@/lib/stellar/types";
import { LiveNumber, Signed } from "@/components/ui/value";

/** Instantaneous skew-driven funding rate, mirroring perp_engine.update_funding. */
function fundingRateBps(longUnits: number, shortUnits: number, maxBps: number): number {
  const total = longUnits + shortUnits;
  if (total === 0) return 0;
  return ((longUnits - shortUnits) * maxBps) / total;
}

export function MarketStats({ meta, cfg, price }: { meta: MarketMeta; cfg: MarketConfig; price: number }) {
  const oi = useMarketOi(meta.id);
  const longUnits = oi.data ? toUnits(oi.data.long) : 0;
  const shortUnits = oi.data ? toUnits(oi.data.short) : 0;
  const fr = fundingRateBps(longUnits, shortUnits, cfg.maxFundingRateBps) / 100; // %

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-3 lg:grid-cols-6">
      <Item
        label="Mark price"
        value={
          <LiveNumber
