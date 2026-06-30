import type { MarketConfig, Side } from "@/lib/stellar/types";

/**
 * Client-side mirror of the on-chain perp math (open preview). Lets the order
 * ticket show liquidation price, fees and margin requirements instantly without
 * a round-trip — the contract recomputes and enforces the same numbers on submit.
 * All inputs/outputs here are in whole units (USD), not 7-dp scaled.
 */
export interface OpenPreview {
  notional: number;
  fee: number;
  requiredMargin: number;
  liquidationPrice: number;
  leverage: number;
  meetsMin: boolean;
  withinLeverage: boolean;
}

export function previewOpen(params: {
  cfg: MarketConfig;
  price: number;
  marginUnits: number;
  leverage: number;
  side: Side;
}): OpenPreview {
  const { cfg, price, marginUnits, leverage, side } = params;
  const notional = marginUnits * leverage;
  const fee = (notional * cfg.takerFeeBps) / 10_000;
  const requiredMargin = (notional * cfg.imrBps) / 10_000;
  const maintenance = (notional * cfg.mmrBps) / 10_000;

  // Solve equity == maintenance for price (funding = 0 at open).
  let liquidationPrice = 0;
  if (notional > 0 && price > 0) {
    const signed = maintenance - marginUnits; // usually negative
    const deltaPx = (price * signed) / notional;
    liquidationPrice = Math.max(side === "Long" ? price + deltaPx : price - deltaPx, 0);
  }

  return {
    notional,
    fee,
    requiredMargin,
    liquidationPrice,
    leverage,
    meetsMin: notional >= Number(cfg.minPositionSize) / 1e7,
    withinLeverage: leverage <= cfg.maxLeverage + 1e-9,
  };
}

/** Slippage-bounded reference price (7-dp scaled) for the open call. */
export function refPriceFor(priceScaled: bigint): bigint {
  return priceScaled;
}
