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
            Leverage the <span className="text-brand">real world.</span>
          </h1>
          <p className="mt-5 max-w-xl text-balance text-lg text-ink-muted">
            Helix is a decentralized perpetual-futures exchange for gold, FX and crypto — margined and
            settled in on-chain USDC. The only chain whose whole thesis is real-world assets.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/trade">
              <Button variant="primary" size="lg">
                Start trading <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <GetFundsButton variant="secondary" size="lg" label="Get test funds" />
          </div>

          {/* live ticker */}
          <div className="mt-12 grid max-w-3xl grid-cols-1 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-3">
            {MARKETS.map((m) => (
              <Link key={m.id} href="/trade" className="group bg-surface p-4 transition-colors hover:bg-elevated">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{m.ticker}</span>
                  <Badge variant="outline">{m.kind}</Badge>
                </div>
                <div className="tnum mt-2 text-2xl font-semibold">{px(m.feed, m.priceDecimals)}</div>
                <div className="mt-1 text-2xs text-ink-faint">{m.name} · up to {marketLev(m.id)}x</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* stat band */}
      <section className="border-y border-hairline bg-surface/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-hairline md:grid-cols-4">
          <Stat label="Vault TVL" value={vault.data ? fmtCompactUsd(vault.data.lpCash) : "—"} />
          <Stat label="Markets" value={`${MARKETS.length}`} />
          <Stat label="Max leverage" value="25x" />
          <Stat label="Settlement" value="USDC" />
        </div>
      </section>

      {/* why stellar */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          A perp DEX that could only live on Stellar
        </h2>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Stellar was built for FX, anchors, stablecoins and tokenized real-world assets. Helix turns that
          foundation into leveraged, composable derivatives — entirely on-chain in Soroban.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Feature icon={<Boxes className="h-5 w-5" />} title="4-contract protocol">
            Isolated registry, vault, oracle adapter and engine with real cross-contract calls — custody is
            separated from trading logic and upgradeable independently.
          </Feature>
          <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Hardened oracle">
            A swappable Reflector adapter rejects stale prices, bounds tick-to-tick deviation and refuses
            non-positive prices — typed errors, not silent failures.
          </Feature>
          <Feature icon={<Lock className="h-5 w-5" />} title="Shared LP vault">
            One USDC pool backs every position and earns fees + funding, with ERC-4626-style shares and
            engine-gated custody.
          </Feature>
          <Feature icon={<Zap className="h-5 w-5" />} title="Real-time, on-chain">
            Positions, funding and liquidations stream from Soroban events into a live terminal — no
            centralized backend in the trade path.
          </Feature>
          <Feature icon={<LineChart className="h-5 w-5" />} title="Funding & liquidations">
            Skew-driven funding and keeper liquidations keep markets balanced and the vault solvent.
          </Feature>
          <Feature icon={<ShieldCheck className="h-5 w-5" />} title="RBAC + pause">
            OpenZeppelin access control, a global kill-switch and per-market pause gate every privileged action.
          </Feature>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 md:flex-row">
          <div className="flex items-center gap-2 text-sm text-ink-faint">
            <Logo /> · built on Soroban
          </div>
          <div className="flex items-center gap-5 text-sm text-ink-muted">
            <a href={explorerContract(CONFIG.contracts.perpEngine)} target="_blank" rel="noreferrer" className="hover:text-ink">
              Contracts ↗
            </a>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-ink">
              <Github className="h-4 w-4" /> GitHub
            </a>
            <Link href="/trade" className="hover:text-ink">
              Launch ↗
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function marketLev(id: number) {
  return id === 2 ? 25 : id === 1 ? 20 : 10;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas px-5 py-6 text-center md:text-left">
      <p className="text-2xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="tnum mt-1 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-line">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-canvas text-brand">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-medium text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{children}</p>
    </div>
  );
}
