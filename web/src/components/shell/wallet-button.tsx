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
        className="focus-ring flex items-center gap-2 rounded-full border border-line bg-elevated px-3 py-1.5 text-sm transition-all hover:border-ink-faint/70 hover:bg-elevated/70"
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
          <div className="glass absolute right-0 z-50 mt-2 w-64 max-w-[calc(100vw-1.5rem)] animate-slide-up rounded-xl border border-hairline p-2 shadow-pop">
            <div className="rounded-md bg-canvas p-3">
              <p className="text-2xs text-ink-faint">Balance</p>
              <p className="tnum text-lg font-semibold text-ink">
                {balance.data !== undefined ? fmtUsd(balance.data) : "—"} <span className="text-xs text-ink-faint">USDC</span>
              </p>
              <p className="tnum mt-1 break-all text-2xs text-ink-faint">{address}</p>
            </div>
            <div className="mt-2 px-1">
              <GetFundsButton size="sm" variant="secondary" className="w-full" />
            </div>
            <div className="mt-1 space-y-0.5">
              <MenuItem
                icon={<Copy className="h-3.5 w-3.5" />}
                label="Copy address"
                onClick={() => navigator.clipboard.writeText(address)}
              />
              <a href={explorerAccount(address)} target="_blank" rel="noreferrer" className="block">
                <MenuItem icon={<ExternalLink className="h-3.5 w-3.5" />} label="View on explorer" />
              </a>
              <MenuItem
                icon={<LogOut className="h-3.5 w-3.5" />}
                label="Disconnect"
                danger
                onClick={() => {
                  disconnect();
                  setOpen(false);
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`focus-ring flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-canvas ${
        danger ? "text-short" : "text-ink-muted hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
