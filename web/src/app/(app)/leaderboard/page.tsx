"use client";
import { Crown, Medal, TrendingUp, Trophy, Users } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat";
import { explorerAccount } from "@/config";
import { useLeaderboard } from "@/hooks/use-chain";
import { fmtCompactUsd, fmtPct, fmtSignedUsd, shortAddr } from "@/lib/format";
import type { TraderRow } from "@/lib/stellar/indexer";
import { cn } from "@/lib/utils";

function rankBadge(i: number) {
  if (i === 0) return <Crown className="h-4 w-4 text-brand" />;
  if (i === 1) return <Trophy className="h-4 w-4 text-ink-muted" />;
  if (i === 2) return <Medal className="h-4 w-4 text-brand-muted" />;
  return <span className="tnum text-xs text-ink-faint">{i + 1}</span>;
}

function winRate(r: TraderRow): string {
  return r.closed > 0 ? fmtPct(r.wins / r.closed, 0) : "—";
}

export default function LeaderboardPage() {
  const { data, isLoading } = useLeaderboard();
  const rows = data?.rows ?? [];
  const stats = data?.stats;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink">Leaderboard</h1>
          <p className="text-sm text-ink-muted">
            Traders ranked by realized PnL — aggregated live from on-chain engine events. No backend, no database.
          </p>
        </div>
        <div className="flex items-center gap-2 text-2xs text-ink-faint">
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-long" /> indexed from Soroban RPC
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Total volume"
          value={stats ? fmtCompactUsd(stats.volume) : "—"}
          sub="notional opened"
        />
        <StatTile label="Trades" value={stats ? stats.trades.toLocaleString() : "—"} sub="positions opened" />
        <StatTile label="Traders" value={stats ? stats.traders.toLocaleString() : "—"} sub="unique addresses" />
        <StatTile
          label="Liquidations"
          value={stats ? stats.liquidations.toLocaleString() : "—"}
          sub="keeper-enforced"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand" /> Top traders
          </CardTitle>
          <span className="text-2xs text-ink-faint">{rows.length} ranked</span>
        </CardHeader>

        {isLoading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty
            icon={<Users className="h-6 w-6" />}
            title="No ranked traders yet"
            description="Once positions are opened and closed on-chain, the leaderboard fills from live events."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-2xs uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-medium">#</th>
                  <th className="px-4 py-2.5 font-medium">Trader</th>
                  <th className="px-4 py-2.5 text-right font-medium">Realized PnL</th>
                  <th className="px-4 py-2.5 text-right font-medium">Volume</th>
                  <th className="px-4 py-2.5 text-right font-medium">Trades</th>
                  <th className="px-4 py-2.5 text-right font-medium">Win rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((r, i) => {
                  const positive = r.realizedPnl >= 0n;
                  return (
                    <tr key={r.address} className={cn("group hover:bg-elevated/50", i < 3 && "bg-brand/[0.02]")}>
                      <td className="px-4 py-3">
                        <span className="flex h-6 w-6 items-center justify-center">{rankBadge(i)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={explorerAccount(r.address)}
                          target="_blank"
                          rel="noreferrer"
                          className="tnum text-ink transition-colors hover:text-brand"
                        >
                          {shortAddr(r.address, 5)}
                        </a>
                        {r.liquidations > 0 && (
                          <span className="ml-2 text-2xs text-short">{r.liquidations} liq</span>
                        )}
                      </td>
                      <td
                        className={cn(
                          "tnum px-4 py-3 text-right font-medium",
                          positive ? "text-long" : "text-short",
                        )}
                      >
                        {fmtSignedUsd(r.realizedPnl)}
                      </td>
                      <td className="tnum px-4 py-3 text-right text-ink-muted">{fmtCompactUsd(r.volume)}</td>
                      <td className="tnum px-4 py-3 text-right text-ink-muted">{r.trades}</td>
                      <td className="tnum px-4 py-3 text-right text-ink-muted">{winRate(r)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-2xs text-ink-faint">
        PnL is net of fees and funding, realized on position close. Rankings reflect the RPC's retained event
        window (~24h on testnet).
      </p>
    </div>
  );
}
