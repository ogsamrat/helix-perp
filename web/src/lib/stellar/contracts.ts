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

// ----------------------------------------------------------- oracle reads
export async function getPrice(feed: string): Promise<OraclePrice> {
  const o = await readContract<any>(C.oracleAdapter, "get_price", [arg.sym(feed)]);
  return { price: BigInt(o.price), timestamp: Number(o.timestamp) };
}

export async function getAllPrices(feeds: string[]): Promise<Record<string, OraclePrice>> {
  const entries = await Promise.all(
    feeds.map(async (f) => {
      try {
        return [f, await getPrice(f)] as const;
      } catch {
        return [f, { price: 0n, timestamp: 0 }] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

// ----------------------------------------------------------- engine reads
export async function getUserPositions(owner: string): Promise<PositionView[]> {
  const raw = await readContract<any[]>(C.perpEngine, "user_positions", [arg.addr(owner)]);
  return (raw ?? []).map(decodePosition);
}

export async function getPositionView(id: bigint): Promise<PositionView> {
  const o = await readContract<any>(C.perpEngine, "position_view", [arg.u64(id)]);
  return decodePosition(o);
}

export async function getMarketOi(marketId: number): Promise<{ long: bigint; short: bigint; funding: bigint }> {
  const [long, short, funding] = await Promise.all([
    readContract<bigint>(C.perpEngine, "long_oi", [arg.u32(marketId)]),
    readContract<bigint>(C.perpEngine, "short_oi", [arg.u32(marketId)]),
    readContract<bigint>(C.perpEngine, "cumulative_funding", [arg.u32(marketId)]),
  ]);
  return { long: BigInt(long ?? 0n), short: BigInt(short ?? 0n), funding: BigInt(funding ?? 0n) };
}

// ----------------------------------------------------------- vault reads
export async function getVaultStats(): Promise<VaultStats> {
  const [lpCash, marginPool, totalShares, sharePrice, totalAssets, utilizationBps] = await Promise.all([
    readContract<bigint>(C.collateralVault, "lp_cash"),
    readContract<bigint>(C.collateralVault, "margin_pool"),
    readContract<bigint>(C.collateralVault, "total_shares"),
    readContract<bigint>(C.collateralVault, "share_price"),
    readContract<bigint>(C.collateralVault, "total_assets"),
    readContract<bigint>(C.collateralVault, "utilization_bps"),
  ]);
  return {
    lpCash: BigInt(lpCash ?? 0n),
    marginPool: BigInt(marginPool ?? 0n),
    totalShares: BigInt(totalShares ?? 0n),
    sharePrice: BigInt(sharePrice ?? 0n),
    totalAssets: BigInt(totalAssets ?? 0n),
    utilizationBps: BigInt(utilizationBps ?? 0n),
  };
}

export async function getVaultShares(owner: string): Promise<bigint> {
  const v = await readContract<bigint>(C.collateralVault, "shares_of", [arg.addr(owner)]);
  return BigInt(v ?? 0n);
}

export async function getUsdcBalance(owner: string): Promise<bigint> {
