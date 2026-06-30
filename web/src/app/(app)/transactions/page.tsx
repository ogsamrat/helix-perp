"use client";
import { CheckCircle2, ExternalLink, Loader2, Receipt, RotateCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { explorerTx } from "@/config";
import { shortAddr } from "@/lib/format";
import { useTxStore, type TxStatus } from "@/lib/tx/store";

const STATUS: Record<TxStatus, { label: string; node: React.ReactNode; variant: "neutral" | "long" | "short" | "warn" }> = {
  signing: { label: "Awaiting signature", node: <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />, variant: "warn" },
  pending: { label: "Processing", node: <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />, variant: "warn" },
  confirmed: { label: "Confirmed", node: <CheckCircle2 className="h-3.5 w-3.5 text-long" />, variant: "long" },
  failed: { label: "Failed", node: <XCircle className="h-3.5 w-3.5 text-short" />, variant: "short" },
};

export default function TransactionsPage() {
  const { txs, retry, clear } = useTxStore();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink">Transactions</h1>
          <p className="text-sm text-ink-muted">Every write goes through one lifecycle: sign → submit → confirm.</p>
        </div>
        {txs.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear history
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <span className="text-2xs text-ink-faint">{txs.length}</span>
        </CardHeader>
        {txs.length === 0 ? (
          <Empty
            icon={<Receipt className="h-6 w-6" />}
            title="No transactions yet"
            description="Open a position, manage margin, or provide liquidity — they'll be tracked here."
          />
        ) : (
          <div className="divide-y divide-hairline">
            {txs.map((t) => {
              const s = STATUS[t.status];
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="shrink-0">{s.node}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{t.label}</p>
                    <p className="truncate text-2xs text-ink-faint">
                      {t.hash ? (
                        <span className="tnum">{shortAddr(t.hash, 6)}</span>
                      ) : (
                        t.error ?? "—"
                      )}
                    </p>
                  </div>
                  <Badge variant={s.variant}>{s.label}</Badge>
                  {t.hash && (
                    <a href={explorerTx(t.hash)} target="_blank" rel="noreferrer" className="text-ink-faint hover:text-brand">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {t.status === "failed" && (
                    <Button size="sm" variant="secondary" onClick={() => retry(t.id)}>
                      <RotateCw className="h-3.5 w-3.5" /> Retry
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
