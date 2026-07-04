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
import { REFLECTOR_SYMBOLS, readReflectorPrice } from "./reflector.js";
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
/**
 * Max fractional step per cycle when converging a relayed real price toward its
 * target — stays comfortably inside the oracle adapter's deviation guard so a
 * large first move (e.g. XLM 0.12 -> 0.21) is walked in over a couple of cycles
 * instead of tripping `PriceDeviationTooHigh`.
 */
const MAX_RELAY_STEP_FRACTION = 0.35;

export interface CycleResult {
  fundingUpdated: number;
  fundingFailed: number;
  openPositions: number;
  liquidated: number;
  notLiquidatable: number;
  pricesSimulated: number;
  pricesRelayed: number;
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
      pricesRelayed: 0,
    };

    const startedAt = Date.now();
    log.info("cycle start", { keeper: this.client.keeperPublicKey });

    // Price source, per market: relay a real Reflector price where a testnet
    // feed exists, otherwise fall back to the bounded simulated walk.
    if (this.config.relayReflector || this.config.simulatePrices) {
      await this.refreshPrices(result);
    }

    await this.updateAllFunding(result);

    // Refresh the open-position set from chain events before scanning.
    try {
      await this.indexer.sync();
    } catch (err) {
      captureError(err, { scope: "indexer.sync" });
    }

    await this.scanLiquidations(result);

    log.info("cycle done", { ...result, durationMs: Date.now() - startedAt });
    return result;
  }

  // --- step 1: price source (relay real Reflector, else simulate) ----------

  private async refreshPrices(result: CycleResult): Promise<void> {
    for (const market of MARKETS) {
      const symbol = this.config.relayReflector ? REFLECTOR_SYMBOLS[market.feed] : null;
      try {
        let next: number;
        let relayed = false;

        if (symbol) {
          const real = await readReflectorPrice(this.client, this.config.reflectorOracleId, symbol);
          if (real) {
            next = this.stepToward(market, Number(real.price14) / 10 ** ORACLE_DECIMALS);
            relayed = true;
          } else {
            if (!this.config.simulatePrices) continue; // no feed, no sim -> leave as-is
            next = this.nextSimPrice(market);
          }
        } else {
          if (!this.config.simulatePrices) continue;
          next = this.nextSimPrice(market);
        }

        const scaled = priceToOracleI128(next, ORACLE_DECIMALS);
        await this.client.invoke(this.config.mockOracleId, "set_price", [
          StellarClient.reflectorOtherScVal(market.feed),
          StellarClient.i128ScVal(scaled),
        ]);
        this.lastSimPrice.set(market.id, next);
        if (relayed) result.pricesRelayed++;
        else result.pricesSimulated++;
        log.debug(relayed ? "price relayed" : "price nudged", { market: market.label, price: next });
      } catch (err) {
        captureError(err, { scope: "set_price", market: market.label });
      }
    }
  }

  /**
   * Move the current on-chain price toward a real target, capped at
   * `MAX_RELAY_STEP_FRACTION` per cycle so a large gap is walked in gradually
   * without tripping the adapter's deviation guard.
   */
  private stepToward(market: Market, target: number): number {
    const current = this.lastSimPrice.get(market.id) ?? market.basePrice;
    const maxStep = current * MAX_RELAY_STEP_FRACTION;
    const delta = Math.max(-maxStep, Math.min(maxStep, target - current));
    const next = current + delta;
    const dp = next >= 100 ? 2 : 6;
    const factor = 10 ** dp;
    return Math.round(next * factor) / factor;
  }

  /** Bounded random walk around the base price, max ~1% per tick. */
  private nextSimPrice(market: Market): number {
    const current = this.lastSimPrice.get(market.id) ?? market.basePrice;
    const step = (Math.random() * 2 - 1) * MAX_TICK_FRACTION; // [-1%, +1%]
    let next = current * (1 + step);

    // Mean-revert toward base if we drift too far so the demo stays sane.
    const lower = market.basePrice * (1 - MAX_DRIFT_FRACTION);
    const upper = market.basePrice * (1 + MAX_DRIFT_FRACTION);
    if (next < lower) next = lower;
    if (next > upper) next = upper;

    // Round to the market's price granularity (more dp for small prices).
    const dp = market.basePrice >= 100 ? 2 : 6;
    const factor = 10 ** dp;
    return Math.round(next * factor) / factor;
  }

  // --- step 2: funding ------------------------------------------------------

  private async updateAllFunding(result: CycleResult): Promise<void> {
    for (const market of MARKETS) {
      try {
        await this.client.invoke(this.config.perpEngineId, "update_funding", [
          StellarClient.addressScVal(this.client.keeperPublicKey),
          StellarClient.u32ScVal(market.id),
        ]);
        result.fundingUpdated++;
        log.info("funding updated", { market: market.label, marketId: market.id });
      } catch (err) {
        result.fundingFailed++;
        captureError(err, { scope: "update_funding", market: market.label, marketId: market.id });
      }
    }
  }

  // --- step 3+4: liquidation scan ------------------------------------------

  private async scanLiquidations(result: CycleResult): Promise<void> {
    const ids = this.indexer.openPositionIds();
    result.openPositions = ids.length;
    log.info("scanning positions", { count: ids.length });

    for (const id of ids) {
      let view: PositionView;
      try {
        view = await this.client.read<PositionView>(this.config.perpEngineId, "position_view", [
          StellarClient.u64ScVal(id),
        ]);
      } catch (err) {
        // A view that errors usually means the position no longer exists
        // (closed/liquidated by someone else); the indexer will catch up.
        captureError(err, { scope: "position_view", id: id.toString() });
        continue;
      }

      const underwater = view.equity < view.maintenance_margin;
      log.debug("position health", {
        id: id.toString(),
        equity: view.equity,
        maintenance: view.maintenance_margin,
        underwater,
      });
      if (!underwater) continue;

      try {
        await this.client.invoke(this.config.perpEngineId, "liquidate", [
          StellarClient.addressScVal(this.client.keeperPublicKey),
          StellarClient.u64ScVal(id),
        ]);
        result.liquidated++;
        log.info("liquidated position", {
          id: id.toString(),
          marketId: view.market_id,
          equity: view.equity,
          maintenance: view.maintenance_margin,
        });
      } catch (err) {
        if (isNotLiquidatable(err)) {
          result.notLiquidatable++;
          log.info("position not liquidatable (recovered)", { id: id.toString() });
        } else {
          captureError(err, { scope: "liquidate", id: id.toString() });
        }
      }
    }
  }
}

/**
 * Detect the engine's `NotLiquidatable` error (variant #11). The exact wire
 * shape varies (prepare-time simulation string vs. tx result), so we match
 * either the symbolic name or the contract-error code defensively.
 */
function isNotLiquidatable(err: unknown): boolean {
  const raw =
    err instanceof ContractCallError
      ? err.raw + " " + err.message
      : err instanceof Error
        ? err.message
        : String(err);
  return (
    /NotLiquidatable/i.test(raw) ||
    /Error\(Contract,\s*#?11\)/i.test(raw) ||
    /#11\b/.test(raw)
  );
}
