"use client";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { WalletButton } from "@/components/shell/wallet-button";
import { useMarkets } from "@/hooks/use-chain";

export function Topbar() {
  const markets = useMarkets();
  const paused = markets.data?.some((m) => m.paused);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-hairline bg-canvas/80 px-4 backdrop-blur md:px-6">
      <Link href="/" className="md:hidden">
