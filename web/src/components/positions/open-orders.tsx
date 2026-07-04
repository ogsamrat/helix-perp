"use client";
import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { marketById } from "@/config";
import { useChainAction, useOrders } from "@/hooks/use-chain";
import { fmtPrice, fmtUsd } from "@/lib/format";
import { calls } from "@/lib/stellar/contracts";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/wallet/store";

/** Resting conditional orders (entry limits + stops) with one-tap cancel. */
export function OpenOrders() {
  const address = useWallet((s) => s.address);
  const { data } = useOrders();
  const action = useChainAction();
  const orders = data ?? [];

  if (!address) {
    return (
      <Empty
        icon={<Inbox className="h-6 w-6" />}
        title="No open orders"
        description="Connect your wallet to see resting limit and stop orders."
      />
    );
  }
  if (orders.length === 0) {
    return (
      <Empty
        icon={<Inbox className="h-6 w-6" />}
        title="No resting orders"
        description="Place a limit order or a stop-loss to see it here."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-hairline text-left text-2xs uppercase tracking-wide text-ink-faint">
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 font-medium">Market</th>
            <th className="px-4 py-2.5 font-medium">Side</th>
            <th className="px-4 py-2.5 text-right font-medium">Trigger</th>
            <th className="px-4 py-2.5 text-right font-medium">Size</th>
            <th className="px-4 py-2.5 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {orders.map((o) => {
            const meta = marketById(o.marketId);
            const dec = meta?.priceDecimals ?? 2;
            const isLong = o.side === "Long";
            return (
              <tr key={o.id.toString()} className="hover:bg-elevated/50">
                <td className="px-4 py-3">
                  <Badge variant="outline">{o.reduce ? "Stop" : "Limit"}</Badge>
                </td>
                <td className="px-4 py-3 text-ink">{meta?.ticker ?? `Market ${o.marketId}`}</td>
                <td className={cn("px-4 py-3 font-medium", isLong ? "text-long" : "text-short")}>
                  {o.reduce ? `Close ${o.side}` : o.side}
                </td>
                <td className="tnum px-4 py-3 text-right text-ink">{fmtPrice(o.triggerPrice, dec)}</td>
                <td className="tnum px-4 py-3 text-right text-ink-muted">{fmtUsd(o.notional)}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={action.isPending}
                    onClick={() => action.mutateAsync({ call: calls.cancelOrder(address, o.id) })}
                  >
                    Cancel
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
