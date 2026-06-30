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
