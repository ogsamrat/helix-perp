"use client";
import { ChevronDown, Copy, ExternalLink, LogOut, Wallet } from "lucide-react";
import { useState } from "react";
import { GetFundsButton } from "@/components/shell/get-funds";
import { Button } from "@/components/ui/button";
import { explorerAccount } from "@/config";
import { useUsdcBalance } from "@/hooks/use-chain";
import { fmtUsd, shortAddr } from "@/lib/format";
import { useWallet } from "@/lib/wallet/store";

export function WalletButton() {
  const { address, connecting, connect, disconnect } = useWallet();
  const balance = useUsdcBalance();
  const [open, setOpen] = useState(false);

  if (!address) {
    return (
      <Button variant="primary" size="sm" loading={connecting} onClick={() => connect()}>
        <Wallet className="h-4 w-4" /> Connect wallet
      </Button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-line bg-elevated px-2.5 py-1.5 text-sm transition-colors hover:border-ink-faint"
      >
        {balance.data !== undefined && (
          <span className="tnum hidden text-ink-muted sm:inline">{fmtUsd(balance.data)}</span>
        )}
        <span className="h-1.5 w-1.5 rounded-full bg-long" />
        <span className="tnum font-medium text-ink">{shortAddr(address)}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-faint" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-64 animate-slide-up rounded-lg border border-hairline bg-elevated p-2 shadow-pop">
            <div className="rounded-md bg-canvas p-3">
              <p className="text-2xs text-ink-faint">Balance</p>
              <p className="tnum text-lg font-semibold text-ink">
                {balance.data !== undefined ? fmtUsd(balance.data) : "—"} <span className="text-xs text-ink-faint">USDC</span>
              </p>
              <p className="tnum mt-1 break-all text-2xs text-ink-faint">{address}</p>
            </div>
            <div className="mt-2 px-1">
              <GetFundsButton size="sm" variant="secondary" className="w-full" />
