/**
 * Real Reflector oracle bridge.
 *
 * Reads live prices from Reflector's decentralised SEP-40 oracle on Stellar
 * testnet and hands them to the keeper, which relays them into the protocol's
 * oracle. Reflector and the mock oracle both report at 14 decimals, so the raw
 * price passes through unscaled.
 *
 * Testnet feed coverage (oracle `CCYOZJ…`): XLM, BTC, ETH, EURC, and other
 * CEX-listed symbols. Gold (XAU) has no testnet feed, so it stays on the
 * keeper's simulated walk. EUR is proxied by EURC (a USD-quoted euro stablecoin).
 */

import { StellarClient } from "./stellar.js";
import { log } from "./logger.js";

/** Reflector's public testnet oracle carrying CEX symbol prices (SEP-40). */
export const DEFAULT_REFLECTOR_ORACLE = "CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63";

/**
 * Map a Helix feed to a Reflector asset symbol. `null` means "no testnet feed"
 * — the keeper keeps simulating that market instead of relaying.
 */
export const REFLECTOR_SYMBOLS: Record<string, string | null> = {
  XAU: null, // no gold feed on testnet — simulated
  EUR: "EURC", // euro stablecoin, USD-quoted — a real EUR/USD proxy
  XLM: "XLM", // the native asset, live from Reflector
};

interface RawPrice {
  price: bigint;
  timestamp: bigint | number;
}

/**
 * Read the latest Reflector price for `symbol` (14-dp), or `null` if the feed
 * has no record. Read-only simulation — never signs.
 */
export async function readReflectorPrice(
  client: StellarClient,
  oracleId: string,
  symbol: string,
): Promise<{ price14: bigint; timestamp: number } | null> {
  try {
    const res = await client.read<RawPrice | null>(oracleId, "lastprice", [
      StellarClient.reflectorOtherScVal(symbol),
    ]);
    if (!res || res.price === undefined) return null;
    return { price14: BigInt(res.price), timestamp: Number(res.timestamp) };
  } catch (err) {
    log.warn("reflector read failed", { symbol, err: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
