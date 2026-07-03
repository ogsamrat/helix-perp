"use client";
import { Inbox, Settings2 } from "lucide-react";
import { useState } from "react";
import { ManageDialog } from "@/components/positions/manage-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Signed } from "@/components/ui/value";
import { marketById, type MarketMeta } from "@/config";
import { useChainAction, usePositions } from "@/hooks/use-chain";
import { fmtPrice, fmtSignedUsd, fmtUsd, toScaled, toUnits } from "@/lib/format";
import { calls } from "@/lib/stellar/contracts";
import type { PositionView } from "@/lib/stellar/types";
import { useLiveMap } from "@/lib/ui/live-price";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/wallet/store";

export function PositionsTable({ marketId }: { marketId?: number }) {
  const address = useWallet((s) => s.address);
  const { data, isLoading } = usePositions();
  const positions = (data ?? []).filter((p) => (marketId ? p.marketId === marketId : true));

  if (!address) {
    return <Empty icon={<Inbox className="h-6 w-6" />} title="Connect your wallet" description="Your open positions will appear here." />;
  }
  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  if (positions.length === 0) {
    return <Empty icon={<Inbox className="h-6 w-6" />} title="No open positions" description="Open a position from the trade ticket to get started." />;
  }

  return (
    <div className="divide-y divide-hairline">
      <div className="hidden grid-cols-12 gap-2 px-4 py-2 text-2xs uppercase tracking-wide text-ink-faint md:grid">
        <div className="col-span-2">Market</div>
        <div className="col-span-2 text-right">Size</div>
        <div className="col-span-2 text-right">Entry / Mark</div>
        <div className="col-span-2 text-right">PnL</div>
        <div className="col-span-2 text-right">Liq. / Margin</div>
        <div className="col-span-2 text-right">Actions</div>
      </div>
      {positions.map((p) => (
        <PositionRow key={p.id.toString()} p={p} />
      ))}
    </div>
  );
}

function PositionRow({ p }: { p: PositionView }) {
  const meta = marketById(p.marketId);
  const address = useWallet((s) => s.address);
  const action = useChainAction();
  const live = useLiveMap();
  const [manage, setManage] = useState(false);
  if (!meta) return null;

  // Mark + PnL track the live price; margin/liq come from chain.
  const liveMark = live[meta.feed] ?? toUnits(p.markPrice);
  const entry = toUnits(p.entryPrice);
  const notional = toUnits(p.notional);
  const sideMul = p.side === "Long" ? 1 : -1;
  const pnlUnits = entry > 0 ? ((notional * (liveMark - entry)) / entry) * sideMul : 0;
  const marginUnits = toUnits(p.margin);
  const netUnits = pnlUnits - toUnits(p.funding);
  const pnlPct = marginUnits > 0 ? (netUnits / marginUnits) * 100 : 0;
  const ratioBps = Number(p.marginRatioBps);
  const healthColor = ratioBps < 400 ? "text-short" : ratioBps < 800 ? "text-warn" : "text-long";

  const close = () =>
    address && action.mutate({ call: calls.closePosition(address, p.id) });

  return (
    <div className="grid grid-cols-2 items-center gap-y-3 px-4 py-3 text-sm md:grid-cols-12 md:gap-2">
      <div className="col-span-2 flex items-center gap-2">
        <div>
          <div className="font-medium text-ink">{meta.ticker}</div>
          <Badge variant={p.side === "Long" ? "long" : "short"}>{p.side}</Badge>
        </div>
      </div>
      <Cell label="Size" className="md:col-span-2">
        <span className="tnum text-ink">{fmtUsd(p.notional)}</span>
      </Cell>
      <Cell label="Entry / Mark" className="md:col-span-2">
        <div className="tnum text-ink">{fmtPrice(p.entryPrice, meta.priceDecimals)}</div>
        <div className="tnum text-2xs text-ink-faint">{fmtPrice(toScaled(liveMark), meta.priceDecimals)}</div>
      </Cell>
      <Cell label="PnL" className="md:col-span-2">
        <Signed positive={netUnits >= 0}>{fmtSignedUsd(toScaled(netUnits))}</Signed>
        <div className="tnum text-2xs">
          <Signed positive={netUnits >= 0}>
            {pnlPct >= 0 ? "+" : ""}
            {pnlPct.toFixed(2)}%
          </Signed>
        </div>
      </Cell>
      <Cell label="Liq. / Margin" className="md:col-span-2">
        <div className="tnum text-warn">{fmtPrice(p.liquidationPrice, meta.priceDecimals)}</div>
        <div className={cn("tnum text-2xs", healthColor)}>{(ratioBps / 100).toFixed(2)}% ratio</div>
      </Cell>
      <div className="col-span-2 flex items-center justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => setManage(true)} aria-label="Manage">
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="secondary" loading={action.isPending} onClick={close}>
          Close
        </Button>
      </div>
      <ManageDialog position={p} meta={meta} open={manage} onClose={() => setManage(false)} />
    </div>
  );
}

function Cell({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-right", className)}>
      <div className="text-2xs uppercase tracking-wide text-ink-faint md:hidden">{label}</div>
      {children}
    </div>
  );
}
