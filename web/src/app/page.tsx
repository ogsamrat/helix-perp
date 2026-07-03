"use client";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { HeroPreview } from "@/components/brand/hero-preview";
import { GetFundsButton } from "@/components/shell/get-funds";
import { Button } from "@/components/ui/button";
import { LiveNumber, Num } from "@/components/ui/value";
import { Reveal } from "@/components/ui/reveal";
import { CONFIG, explorerContract, MARKETS } from "@/config";
import { usePrices, useVaultStats } from "@/hooks/use-chain";
import { fmtCompactUsd, toUnits } from "@/lib/format";
import { useLiveMap } from "@/lib/ui/live-price";
import { cn } from "@/lib/utils";

function seededChange(feed: string) {
  let h = 0;
  for (let i = 0; i < feed.length; i++) h = (h * 31 + feed.charCodeAt(i)) >>> 0;
  return (h % 600) / 100 - 3;
}

const FEATURES = [
  { title: "A four-contract protocol", body: "Registry, vault, oracle adapter and engine with real cross-contract calls. Custody is separated from logic and each contract upgrades independently." },
  { title: "A hardened oracle", body: "A swappable Reflector adapter rejects stale prices, bounds tick-to-tick deviation and refuses non-positive prices — typed errors, never silent failure." },
  { title: "One shared vault", body: "A single USDC pool is the counterparty to every position and earns fees plus funding, with ERC-4626-style shares and engine-gated custody." },
  { title: "Real-time and on-chain", body: "Positions, funding and liquidations stream from Soroban events into a live terminal. No centralized backend sits in the trade path." },
  { title: "Funding and liquidations", body: "Skew-driven funding and keeper liquidations keep markets balanced and the vault solvent, with a solvency floor enforced in the contract." },
  { title: "Access control and pause", body: "Role-based access control, a global kill-switch and per-market pause gate every privileged action." },
];

export default function Landing() {
  const prices = usePrices();
  const vault = useVaultStats();
  const live = useLiveMap();
  const priceUnits = (feed: string) => live[feed] ?? toUnits(prices.data?.[feed]?.price ?? 0n);

  return (
    <div className="relative min-h-screen">
      {/* header */}
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/85 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-ink-muted md:flex">
            <Link href="/trade" className="transition-colors hover:text-ink">Trade</Link>
            <Link href="/vault" className="transition-colors hover:text-ink">Vault</Link>
            <Link href="/analytics" className="transition-colors hover:text-ink">Analytics</Link>
          </nav>
          <Link href="/trade">
            <Button variant="primary" size="sm">
              Launch terminal <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-6 pb-24 pt-24 md:pt-32 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <p className="eyebrow mb-8 animate-reveal-up" style={{ animationDelay: "0ms" }}>
              Decentralized perpetual futures · Soroban
            </p>
            <h1
              className="font-display max-w-2xl animate-reveal-up text-[3.5rem] leading-[0.93] tracking-[-0.045em] text-ink sm:text-6xl md:text-[5.25rem]"
              style={{ animationDelay: "80ms" }}
            >
              Leverage the real world.
            </h1>
          <p
            className="mt-8 max-w-lg animate-reveal-up text-lg leading-relaxed text-ink-muted"
            style={{ animationDelay: "180ms" }}
          >
            A perpetual-futures exchange for gold, FX and crypto — margined and settled in on-chain
            USDC, on the one chain built for the real world.
          </p>
          <div className="mt-9 flex animate-reveal-up flex-wrap items-center gap-3" style={{ animationDelay: "260ms" }}>
            <Link href="/trade">
              <Button variant="primary" size="lg">
                Start trading <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <GetFundsButton variant="secondary" size="lg" label="Get test funds" />
          </div>
        </div>
          <div className="relative hidden animate-reveal-up justify-self-center lg:flex lg:justify-self-end" style={{ animationDelay: "340ms" }}>
            <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[48px] bg-brand/[0.09] blur-[90px]" />
            <HeroPreview />
          </div>
        </div>
      </section>

      {/* live marquee (decorative) */}
      <div aria-hidden className="border-y border-hairline bg-surface py-3.5">
        <div className="mask-fade-r overflow-hidden">
          <div className="flex w-max animate-marquee items-center gap-10 pr-10">
            {[...MARKETS, ...MARKETS, ...MARKETS, ...MARKETS].map((m, i) => {
              const chg = seededChange(m.feed);
              return (
                <div key={i} className="flex items-center gap-3 whitespace-nowrap">
                  <span className="text-sm font-medium text-ink">{m.ticker}</span>
                  <LiveNumber value={priceUnits(m.feed)} format={(v) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: m.priceDecimals, maximumFractionDigits: m.priceDecimals })} className="text-sm text-ink-muted" />
                  <span className={cn("tnum text-2xs", chg >= 0 ? "text-long" : "text-short")}>
                    {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
                  </span>
                  <span className="text-ink-faint">·</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* stat band */}
      <Reveal>
        <section className="mx-auto max-w-6xl px-6 pt-16">
          <div className="grid grid-cols-2 divide-x divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface md:grid-cols-4">
            <Stat label="Vault TVL" value={vault.data ? fmtCompactUsd(vault.data.lpCash) : "—"} />
            <Stat label="Markets" value={`${MARKETS.length}`} />
            <Stat label="Max leverage" value="25x" />
            <Stat label="Settlement" value="USDC" />
          </div>
        </section>
      </Reveal>

      {/* narrative */}
      <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="grid gap-10 md:grid-cols-12 md:gap-16">
          <Reveal className="md:col-span-5">
            <p className="eyebrow mb-5">Why Stellar</p>
            <h2 className="font-display text-4xl leading-[1.05] text-ink md:text-5xl">
              A perp DEX that could only live here.
            </h2>
          </Reveal>
          <Reveal delay={120} className="space-y-6 md:col-span-7 md:pt-2">
            <p className="text-lg leading-relaxed text-ink-muted">
              Stellar was built for FX, anchors, stablecoins and tokenized real-world assets. Helix
              turns that foundation into leveraged, composable derivatives — entirely on-chain in
              Soroban.
            </p>
            <p className="text-base leading-relaxed text-ink-faint">
              The flagship markets are gold, the euro and lumens, all settled in on-chain USDC. The
              engine is asset-agnostic, so listing crypto majors is a single line of configuration.
            </p>
          </Reveal>
        </div>
      </section>

      {/* markets */}
      <Reveal>
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <p className="eyebrow mb-8">Live markets</p>
          <div className="border-t border-hairline">
            {MARKETS.map((m, i) => {
              const chg = seededChange(m.feed);
              return (
                <Link
                  key={m.id}
                  href="/trade"
                  className="focus-ring group grid grid-cols-[2.5rem_1fr_auto] items-center gap-5 rounded-lg border-b border-hairline px-1 py-6 transition-colors hover:bg-surface/50 md:grid-cols-[3rem_1fr_1fr_auto] md:gap-8"
                >
                  <span className="tnum text-lg text-brand/70">0{i + 1}</span>
                  <div>
                    <div className="font-display text-2xl text-ink md:text-3xl">{m.ticker}</div>
                    <div className="mt-0.5 text-sm text-ink-faint">
                      {m.name} · up to {m.id === 2 ? 25 : m.id === 1 ? 20 : 10}x · {m.kind}
                    </div>
                  </div>
                  <div className="hidden text-right md:block">
                    <LiveNumber value={priceUnits(m.feed)} format={(v) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: m.priceDecimals, maximumFractionDigits: m.priceDecimals })} className="text-lg text-ink" />
                    <div className={cn("tnum text-xs", chg >= 0 ? "text-long" : "text-short")}>
                      {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
                    </div>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              );
            })}
          </div>
        </section>
      </Reveal>

      {/* features */}
      <section className="border-t border-hairline bg-surface/40">
        <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="grid gap-10 md:grid-cols-12 md:gap-16">
            <Reveal className="md:col-span-4">
              <p className="eyebrow mb-5">The protocol</p>
              <h2 className="font-display text-4xl leading-[1.05] text-ink md:text-5xl">
                Real DeFi, not a demo.
              </h2>
              <p className="mt-6 text-sm leading-relaxed text-ink-faint">
                Thirty-three contract tests, six contracts deployed and seeded on testnet, and a live
                terminal you can feel in ten seconds.
              </p>
            </Reveal>
            <div className="md:col-span-8">
              <div className="grid sm:grid-cols-2">
                {FEATURES.map((f, i) => (
                  <Reveal
                    key={f.title}
                    delay={(i % 2) * 90}
                    className="flex gap-5 border-t border-hairline py-7 sm:[&:nth-child(-n+2)]:border-t-0 sm:[&:nth-child(odd)]:pr-8"
                  >
                    <span className="tnum text-lg text-brand/70">0{i + 1}</span>
                    <div>
                      <h3 className="text-base font-medium text-ink">{f.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* closing CTA */}
      <Reveal>
        <section className="mx-auto max-w-6xl px-6 py-24 text-center md:py-28">
          <p className="eyebrow mb-6">Live on Stellar {CONFIG.network}</p>
          <h2 className="font-display mx-auto max-w-3xl text-balance text-5xl leading-[1.03] text-ink md:text-7xl">
            Open a position in sixty seconds.
          </h2>
          <div className="mt-10 flex justify-center gap-3">
            <Link href="/trade">
              <Button variant="primary" size="lg">
                Launch the terminal <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </Reveal>

      {/* footer */}
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-6 py-10 md:flex-row">
          <div className="flex items-center gap-3 text-sm text-ink-faint">
            <Logo /> <span>· built on Soroban</span>
          </div>
          <div className="flex items-center gap-7 text-sm text-ink-muted">
            <a href={explorerContract(CONFIG.contracts.perpEngine)} target="_blank" rel="noreferrer" className="transition-colors hover:text-ink">Contracts</a>
            <a href="https://github.com/ogsamrat/helix-perp" target="_blank" rel="noreferrer" className="transition-colors hover:text-ink">GitHub</a>
            <Link href="/trade" className="transition-colors hover:text-ink">Launch</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 py-7">
      <p className="eyebrow mb-2.5">{label}</p>
      <p className="font-display text-3xl text-ink md:text-4xl">
        <Num>{value}</Num>
      </p>
    </div>
  );
}
