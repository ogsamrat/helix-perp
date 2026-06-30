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
