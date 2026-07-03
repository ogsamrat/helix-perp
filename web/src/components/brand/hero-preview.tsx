import { ArrowUpRight } from "lucide-react";

/** Deterministic candle series (computed once, identical SSR/CSR — no hydration drift). */
const CANDLES = (() => {
  let seed = 9;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let price = 34;
  return Array.from({ length: 20 }, () => {
    const open = price;
    price = Math.max(14, Math.min(80, price + (rnd() - 0.4) * 7));
    const close = price;
    return {
      open,
      close,
      hi: Math.max(open, close) + rnd() * 3,
      lo: Math.min(open, close) - rnd() * 3,
      up: close >= open,
    };
  });
})();

/**
 * A decorative, static mockup of the Helix trade terminal for the hero — glass,
 * gently floating. Not interactive; purely a premium product preview.
 */
export function HeroPreview() {
  return (
    <div className="w-full max-w-md">
      <div className="relative rounded-2xl border border-hairline bg-surface p-4 shadow-elevated">
        {/* header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl tracking-tight text-ink">XAU-PERP</span>
              <span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-2xs text-brand">
                Gold
              </span>
            </div>
            <div className="tnum mt-1 text-2xl font-semibold text-ink">$2,418.40</div>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-long/25 bg-long/10 px-2 py-1 text-xs text-long">
            <ArrowUpRight className="h-3.5 w-3.5" /> <span className="tnum">+1.24%</span>
          </div>
        </div>

        {/* chart */}
        <div className="mt-4 h-36 w-full">
          <svg viewBox="0 0 108 88" preserveAspectRatio="none" className="h-full w-full">
            {[22, 44, 66].map((y) => (
              <line key={y} x1="0" x2="108" y1={y} y2={y} stroke="rgb(48,54,65)" strokeWidth="0.4" strokeOpacity="0.5" />
            ))}
            {CANDLES.map((c, i) => {
              const x = 4 + i * 5.2;
              const col = c.up ? "rgb(53,199,122)" : "rgb(242,94,106)";
              const bodyTop = 88 - Math.max(c.open, c.close);
              const bodyH = Math.max(1.4, Math.abs(c.close - c.open));
              return (
                <g key={i} stroke={col} fill={col}>
                  <line x1={x} x2={x} y1={88 - c.hi} y2={88 - c.lo} strokeWidth="0.7" />
                  <rect x={x - 1.6} y={bodyTop} width="3.2" height={bodyH} rx="0.4" />
                </g>
              );
            })}
          </svg>
        </div>

        {/* stats */}
        <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline text-center">
          {[
            ["Funding", "+0.01%"],
            ["Leverage", "10.0x"],
            ["Liq. price", "$2,220"],
          ].map(([l, v]) => (
            <div key={l} className="bg-surface px-2 py-2">
              <div className="text-2xs uppercase tracking-wide text-ink-faint">{l}</div>
              <div className="tnum mt-0.5 text-xs text-ink">{v}</div>
            </div>
          ))}
        </div>

        {/* long / short */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-long/30 bg-long/15 py-2 text-center text-sm font-semibold text-long">
            Long
          </div>
          <div className="rounded-md border border-line py-2 text-center text-sm font-medium text-ink-faint">
            Short
          </div>
        </div>
        <div className="mt-2 rounded-md bg-paper py-2.5 text-center text-sm font-semibold text-canvas">
          Open position
        </div>
      </div>
    </div>
  );
}
