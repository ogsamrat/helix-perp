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
