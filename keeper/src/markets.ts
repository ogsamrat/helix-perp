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

