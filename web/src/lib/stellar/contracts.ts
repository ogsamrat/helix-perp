/* eslint-disable @typescript-eslint/no-explicit-any */
import { xdr } from "@stellar/stellar-sdk";
import { CONFIG } from "@/config";
import { readContract } from "./client";
import { arg, tagOf } from "./scval";
import type { MarketConfig, OraclePrice, PositionView, Side, VaultStats } from "./types";

const C = CONFIG.contracts;

/** A pending write, executed by the tx-lifecycle hook. */
export interface Call {
  contractId: string;
  method: string;
  args: xdr.ScVal[];
  label: string;
}

// ----------------------------------------------------------- decoders
function decodeMarket(o: any): MarketConfig {
  return {
    id: Number(o.id),
    symbol: o.symbol,
    feed: o.feed,
    maxLeverage: Number(o.max_leverage),
    imrBps: Number(o.imr_bps),
    mmrBps: Number(o.mmr_bps),
    takerFeeBps: Number(o.taker_fee_bps),
    liquidationFeeBps: Number(o.liquidation_fee_bps),
    maxOi: BigInt(o.max_oi),
    minPositionSize: BigInt(o.min_position_size),
    maxFundingRateBps: Number(o.max_funding_rate_bps),
    paused: Boolean(o.paused),
  };
}

function decodePosition(o: any): PositionView {
  return {
    id: BigInt(o.id),
    owner: String(o.owner),
    marketId: Number(o.market_id),
    side: tagOf(o.side) as Side,
    margin: BigInt(o.margin),
    notional: BigInt(o.notional),
    entryPrice: BigInt(o.entry_price),
    markPrice: BigInt(o.mark_price),
    unrealizedPnl: BigInt(o.unrealized_pnl),
    funding: BigInt(o.funding),
    equity: BigInt(o.equity),
    maintenanceMargin: BigInt(o.maintenance_margin),
    liquidationPrice: BigInt(o.liquidation_price),
    leverageBps: BigInt(o.leverage_bps),
    marginRatioBps: BigInt(o.margin_ratio_bps),
  };
}

// ----------------------------------------------------------- registry reads
export async function getAllMarkets(): Promise<MarketConfig[]> {
  const raw = await readContract<any[]>(C.marketRegistry, "get_all_markets");
  return (raw ?? []).map(decodeMarket);
}

export async function isGloballyPaused(): Promise<boolean> {
  return (await readContract<boolean>(C.marketRegistry, "is_paused")) ?? false;
}

