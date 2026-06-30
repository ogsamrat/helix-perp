"use client";
import { ArrowRight, Boxes, Github, LineChart, Lock, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { GetFundsButton } from "@/components/shell/get-funds";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveNumber } from "@/components/ui/value";
import { CONFIG, explorerContract, MARKETS } from "@/config";
import { useVaultStats } from "@/hooks/use-chain";
import { usePrices } from "@/hooks/use-chain";
import { fmtCompactUsd, toUnits } from "@/lib/format";
import { useLiveMap } from "@/lib/ui/live-price";

export default function Landing() {
  const prices = usePrices();
  const vault = useVaultStats();
  const live = useLiveMap();

  const px = (feed: string, decimals: number) => {
    const v = live[feed] ?? toUnits(prices.data?.[feed]?.price ?? 0n);
    return (
      <LiveNumber
        value={v}
        format={(n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
        className="text-ink"
      />
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* header */}
      <header className="sticky top-0 z-30 border-b border-hairline/60 bg-canvas/70 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-ink-muted md:flex">
            <Link href="/trade" className="hover:text-ink">Trade</Link>
            <Link href="/vault" className="hover:text-ink">Vault</Link>
            <Link href="/analytics" className="hover:text-ink">Analytics</Link>
            <a href="https://stellar.org" target="_blank" rel="noreferrer" className="hover:text-ink">
              Stellar
            </a>
          </nav>
          <Link href="/trade">
            <Button variant="primary" size="sm">
              Launch terminal <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="relative">
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute inset-0 radial-fade" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-20 md:pt-28">
          <Badge variant="brand" className="mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-long" /> Live on Stellar {CONFIG.network} · Soroban
          </Badge>
          <h1 className="max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-ink md:text-7xl">
