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
            value={price}
            format={(v) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: meta.priceDecimals, maximumFractionDigits: meta.priceDecimals })}
            className="text-ink"
          />
        }
      />
      <Item label="Index (oracle)" value={<span className="tnum text-ink">{fmtPrice(BigInt(Math.round(price * 1e7)), meta.priceDecimals)}</span>} />
      <Item
        label="Funding / period"
        value={<Signed positive={fr >= 0}>{fr >= 0 ? "+" : ""}{fr.toFixed(4)}%</Signed>}
      />
      <Item label="Long OI" value={<span className="tnum text-long">{fmtCompactUsd(longUnits * 1e7)}</span>} />
      <Item label="Short OI" value={<span className="tnum text-short">{fmtCompactUsd(shortUnits * 1e7)}</span>} />
      <Item label="Max leverage" value={<span className="tnum text-ink">{cfg.maxLeverage}x</span>} />
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <p className="text-2xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
