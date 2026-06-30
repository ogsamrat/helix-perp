/**
 * Static market metadata for the three Helix testnet markets.
 *
 * `id` matches the on-chain market_id (1=XAU, 2=EUR, 3=XLM). `feed` is the
 * Reflector asset selector symbol used to encode `ReflectorAsset::Other(Symbol)`
 * for the mock oracle. `basePrice` is the human-readable USD price used as the
 * centre of the random walk in the optional price simulator.
 */

export interface Market {
  /** On-chain market_id (u32). */
  readonly id: number;
  /** Short label, e.g. "XAU". */
  readonly label: string;
  /** Reflector feed symbol used as the oracle asset selector. */
  readonly feed: string;
  /** Human-readable base price in USD (centre of the random walk). */
  readonly basePrice: number;
}

/** The mock oracle stores prices natively at 14 decimal places. */
export const ORACLE_DECIMALS = 14;

/** Engine/view monetary values and normalized prices are scaled to 7 dp. */
export const ENGINE_DECIMALS = 7;

export const MARKETS: readonly Market[] = [
  { id: 1, label: "XAU", feed: "XAU", basePrice: 2400 },
  { id: 2, label: "EUR", feed: "EUR", basePrice: 1.08 },
  { id: 3, label: "XLM", feed: "XLM", basePrice: 0.12 },
] as const;

export const MARKET_IDS: readonly number[] = MARKETS.map((m) => m.id);

export function marketById(id: number): Market | undefined {
  return MARKETS.find((m) => m.id === id);
}

/**
 * Convert a human price (USD) to the oracle's native i128 at `ORACLE_DECIMALS`.
 * Uses string math via a scaled BigInt to avoid float precision loss.
 */
export function priceToOracleI128(price: number, decimals: number = ORACLE_DECIMALS): bigint {
  if (!Number.isFinite(price) || price < 0) {
    throw new RangeError(`invalid price for oracle scaling: ${price}`);
  }
  // Scale with rounding. We go through a fixed-precision decimal string to keep
  // precision well beyond what JS floats give us directly.
  const [intPart, fracPartRaw = ""] = price.toFixed(decimals).split(".");
  const fracPart = fracPartRaw.padEnd(decimals, "0").slice(0, decimals);
  const digits = `${intPart}${fracPart}`.replace(/^(-?)0+(?=\d)/, "$1");
  return BigInt(digits);
}
