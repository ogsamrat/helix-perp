/**
 * The keeper cycle.
 *
 * One `runCycle()` does, in order:
 *   1. Optional price simulation: nudge mock-oracle prices via a bounded random
 *      walk (only when SIMULATE_PRICES=true).
 *   2. Funding: call `update_funding(keeper, market_id)` for every market.
 *   3. Index: pull new engine events to refresh the open-position id set.
 *   4. Liquidation scan: read `position_view(id)` for each open id and, when
 *      `equity < maintenance_margin`, call `liquidate(keeper, id)`.
 *
 * Every external call is individually guarded so one failing market/position
 * never aborts the rest of the cycle. `NotLiquidatable` is treated as a normal,
 * expected outcome (the position recovered between index and liquidation).
 */

import { StellarClient, ContractCallError } from "./stellar.js";
import { Indexer } from "./indexer.js";
import { MARKETS, ORACLE_DECIMALS, priceToOracleI128 } from "./markets.js";
import type { Market } from "./markets.js";
import type { KeeperConfig } from "./config.js";
import { captureError, log } from "./logger.js";

/** Decoded `PositionView`. i128 fields decode to bigint via scValToNative. */
export interface PositionView {
  id: bigint;
  owner: string;
  market_id: number;
  side: unknown; // Side enum: tag string or {tag} object depending on SDK decode.
  margin: bigint;
  notional: bigint;
  entry_price: bigint;
  mark_price: bigint;
  unrealized_pnl: bigint;
  funding: bigint;
  equity: bigint;
  maintenance_margin: bigint;
  liquidation_price: bigint;
  leverage_bps: bigint;
  margin_ratio_bps: bigint;
}

/** Max fractional move applied to an oracle price per tick (~1%). */
const MAX_TICK_FRACTION = 0.01;
/** Soft band keeping the simulated price near its base (+/- 15%). */
const MAX_DRIFT_FRACTION = 0.15;

export interface CycleResult {
  fundingUpdated: number;
  fundingFailed: number;
  openPositions: number;
  liquidated: number;
  notLiquidatable: number;
  pricesSimulated: number;
}

export class Keeper {
  private readonly lastSimPrice = new Map<number, number>();

  constructor(
    private readonly client: StellarClient,
    private readonly indexer: Indexer,
    private readonly config: KeeperConfig,
  ) {
    for (const m of MARKETS) this.lastSimPrice.set(m.id, m.basePrice);
  }

  async runCycle(): Promise<CycleResult> {
    const result: CycleResult = {
      fundingUpdated: 0,
      fundingFailed: 0,
      openPositions: 0,
      liquidated: 0,
      notLiquidatable: 0,
      pricesSimulated: 0,
    };
