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

export type TriggerDir = "Above" | "Below";

/** A resting conditional order (entry limit, or stop-loss/take-profit). */
export interface OrderView {
  id: bigint;
  owner: string;
  marketId: number;
  side: Side;
  margin: bigint;
  notional: bigint;
  triggerPrice: bigint;
  dir: TriggerDir;
  /** false = entry (open) order; true = stop that closes `reducePosition`. */
  reduce: boolean;
  reducePosition: bigint;
  maxSlippageBps: number;
  createdAt: number;
}

export interface OraclePrice {
  price: bigint;
  timestamp: number;
}

export interface VaultStats {
  lpCash: bigint;
  marginPool: bigint;
  totalShares: bigint;
  sharePrice: bigint;
  totalAssets: bigint;
  utilizationBps: bigint;
}

/** A decoded on-chain event for the activity feed. */
export interface ChainEvent {
  id: string;
  type:
    | "PositionOpened"
    | "PositionClosed"
    | "PositionModified"
    | "PositionLiquidated"
    | "FundingUpdated"
    | "LiquidityAdded"
    | "LiquidityRemoved"
    | "MarginLocked"
    | "Settled"
    | "Unknown";
  ledger: number;
  txHash: string;
  ts: number;
  contractId: string;
  topics: string[];
  data: Record<string, unknown>;
}
