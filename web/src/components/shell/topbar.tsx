"use client";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { WalletButton } from "@/components/shell/wallet-button";
import { useMarkets } from "@/hooks/use-chain";
import { cn } from "@/lib/utils";

export function Topbar() {
  const markets = useMarkets();
  const paused = markets.data?.some((m) => m.paused);
  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-hairline px-4 md:px-6">
      <Link href="/" className="md:hidden">
        <Logo />
      </Link>
      <div className="hidden items-center gap-2 rounded-full border border-hairline bg-canvas/40 px-3 py-1 md:flex">
        <span className={cn("h-1.5 w-1.5 rounded-full", paused ? "bg-warn" : "bg-long")} />
        <span className="text-2xs text-ink-muted">
          {paused ? "Market paused" : "All systems operational"}
        </span>
      </div>
      <WalletButton />
    </header>
  );
}
