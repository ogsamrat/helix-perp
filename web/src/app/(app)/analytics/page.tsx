"use client";
import { AreaChart } from "@/components/charts/area";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat";
import { MARKETS } from "@/config";
import { useMarketOi, useVaultStats } from "@/hooks/use-chain";
import { fmtCompactUsd, fmtPct, toUnits } from "@/lib/format";

function gen(seedStr: string, end: number, n = 48, vol = 0.06): number[] {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  const r = () => {
    h |= 0;
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [1];
  for (let i = 1; i < n; i++) out.push(Math.max(0.05, out[i - 1] * (1 + (r() - 0.45) * vol)));
  const factor = end / (out[n - 1] || 1);
  return out.map((v) => v * factor);
}

export default function AnalyticsPage() {
  const vault = useVaultStats();
  const oi1 = useMarketOi(1);
  const oi2 = useMarketOi(2);
  const oi3 = useMarketOi(3);

  const totalOiUnits =
    (oi1.data ? toUnits(oi1.data.long + oi1.data.short) : 0) +
    (oi2.data ? toUnits(oi2.data.long + oi2.data.short) : 0) +
    (oi3.data ? toUnits(oi3.data.long + oi3.data.short) : 0);

  const tvlUnits = vault.data ? toUnits(vault.data.lpCash) : 0;
  const util = vault.data ? Number(vault.data.utilizationBps) / 100 : 0;
  const volUnits = totalOiUnits * 6.2; // illustrative cumulative volume proxy

  return (
