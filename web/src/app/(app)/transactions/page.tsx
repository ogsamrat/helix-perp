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
          <h1 className="text-lg font-semibold tracking-tight text-ink">Transactions</h1>
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
