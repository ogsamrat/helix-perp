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

describe("previewOpen (mirrors perp_engine math)", () => {
  it("computes size, fee and a long liquidation price", () => {
    const p = previewOpen({ cfg: XAU, price: 2400, marginUnits: 100, leverage: 10, side: "Long" });
    expect(p.notional).toBe(1000);
    expect(p.fee).toBeCloseTo(1, 9); // 0.10% of $1,000
    expect(p.liquidationPrice).toBeCloseTo(2220, 6); // entry - (margin-maint)/notional*entry
    expect(p.meetsMin).toBe(true);
    expect(p.withinLeverage).toBe(true);
  });

  it("is symmetric for shorts", () => {
    const p = previewOpen({ cfg: XAU, price: 2400, marginUnits: 100, leverage: 10, side: "Short" });
    expect(p.liquidationPrice).toBeCloseTo(2580, 6);
  });

  it("flags over-leverage and sub-minimum size", () => {
    expect(previewOpen({ cfg: XAU, price: 2400, marginUnits: 100, leverage: 30, side: "Long" }).withinLeverage).toBe(false);
    expect(previewOpen({ cfg: XAU, price: 2400, marginUnits: 1, leverage: 5, side: "Long" }).meetsMin).toBe(false);
  });
});
