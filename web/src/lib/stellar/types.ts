/** TypeScript mirrors of the on-chain contract types (decoded to camelCase). */

export type Side = "Long" | "Short";

export interface MarketConfig {
  id: number;
  symbol: string;
  feed: string;
  maxLeverage: number;
  imrBps: number;
  mmrBps: number;
  takerFeeBps: number;
  liquidationFeeBps: number;
  maxOi: bigint;
  minPositionSize: bigint;
  maxFundingRateBps: number;
  paused: boolean;
}

export interface PositionView {
  id: bigint;
  owner: string;
  marketId: number;
  side: Side;
  margin: bigint;
  notional: bigint;
  entryPrice: bigint;
  markPrice: bigint;
  unrealizedPnl: bigint;
  funding: bigint;
  equity: bigint;
  maintenanceMargin: bigint;
  liquidationPrice: bigint;
  leverageBps: bigint;
  marginRatioBps: bigint;
}
