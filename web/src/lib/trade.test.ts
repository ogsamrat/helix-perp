import { describe, expect, it } from "vitest";
import type { MarketConfig } from "./stellar/types";
import { previewOpen } from "./trade";

const XAU: MarketConfig = {
  id: 1,
  symbol: "XAUPERP",
  feed: "XAU",
  maxLeverage: 20,
  imrBps: 500,
  mmrBps: 250,
  takerFeeBps: 10,
  liquidationFeeBps: 100,
  maxOi: 10_000_000_000_000n,
  minPositionSize: 100_000_000n, // $10
  maxFundingRateBps: 100,
  paused: false,
};

