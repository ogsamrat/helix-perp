"use client";
import { create } from "zustand";

/**
 * Live "mark" prices for the UI. The on-chain oracle exposes spot snapshots that
 * only change when the keeper refreshes them, so for a smooth, alive demo we drive
 * a mean-reverting random walk around the latest on-chain price (the *anchor*) and
 * use it for the chart, market stats, tickers and position PnL. Order execution
 * still uses the real on-chain price — this is purely a presentation-layer mark.
 */
interface LivePriceState {
  live: Record<string, number>;
  anchors: Record<string, number>;
  setAnchor: (feed: string, price: number) => void;
  step: () => void;
}

export const useLivePriceStore = create<LivePriceState>((set) => ({
  live: {},
  anchors: {},
  setAnchor: (feed, price) =>
    set((s) => {
      if (!(price > 0)) return s;
      const anchors = { ...s.anchors, [feed]: price };
      const live = { ...s.live };
      if (live[feed] === undefined) live[feed] = price;
      return { anchors, live };
    }),
  step: () =>
    set((s) => {
      if (Object.keys(s.anchors).length === 0) return s;
      const live = { ...s.live };
      for (const feed of Object.keys(s.anchors)) {
        const a = s.anchors[feed];
        const cur = live[feed] ?? a;
        const noise = a * (Math.random() - 0.5) * 0.0018; // ~0.09% jitter
        let next = cur + (a - cur) * 0.025 + noise; // gentle pull toward anchor
        next = Math.min(Math.max(next, a * 0.975), a * 1.025); // clamp +/-2.5%
        live[feed] = next;
      }
      return { live };
    }),
}));

export function useLiveMap() {
  return useLivePriceStore((s) => s.live);
}

export function useLivePrice(feed: string) {
  return useLivePriceStore((s) => s.live[feed] ?? s.anchors[feed] ?? 0);
}
