"use client";
import { GetFundsButton } from "@/components/shell/get-funds";
import { PositionsTable } from "@/components/positions/positions-table";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat";
import { Signed } from "@/components/ui/value";
import { marketById } from "@/config";
import { usePositions, useUsdcBalance } from "@/hooks/use-chain";
import { fmtSignedUsd, fmtUsd, toScaled, toUnits } from "@/lib/format";
import { useLiveMap } from "@/lib/ui/live-price";
import { useWallet } from "@/lib/wallet/store";

export default function PortfolioPage() {
  const address = useWallet((s) => s.address);
  const positions = usePositions();
  const balance = useUsdcBalance();
  const live = useLiveMap();

  const list = positions.data ?? [];
  const totalNotional = list.reduce((a, p) => a + p.notional, 0n);
  // Equity + PnL track the live mark for a real-time portfolio.
  let netUnits = 0;
  let equityUnits = 0;
  for (const p of list) {
    const meta = marketById(p.marketId);
    const mark = meta ? (live[meta.feed] ?? toUnits(p.markPrice)) : toUnits(p.markPrice);
    const entry = toUnits(p.entryPrice);
    const side = p.side === "Long" ? 1 : -1;
    const pnl = entry > 0 ? ((toUnits(p.notional) * (mark - entry)) / entry) * side : 0;
    const net = pnl - toUnits(p.funding);
    netUnits += net;
    equityUnits += toUnits(p.margin) + net;
  }

