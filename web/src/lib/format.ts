/**
 * Formatting for on-chain financial data. Every monetary/price value from the
 * contracts is an `i128` scaled to 7 decimals (`SCALE`); these helpers convert to
 * display strings. Pair the output with the `.tnum` class so digits are tabular
 * and never jitter on live updates.
 */

export const SCALE = 10_000_000n; // 1e7
export const SCALE_NUM = 1e7;
export const BPS = 10_000;

export type Scaled = bigint | string | number;

/** Coerce a chain value to bigint (7-dp scaled). */
export function big(v: Scaled): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.round(v));
  return BigInt(v.split(".")[0] || "0");
}

/** Convert a 7-dp scaled value to a JS float in whole units. */
export function toUnits(v: Scaled, scale: bigint = SCALE): number {
  return Number(big(v)) / Number(scale);
}

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: min, maximumFractionDigits: max });

/** Plain number with grouping, e.g. 12,345.67 */
export function fmtNum(v: Scaled, decimals = 2): string {
  return nf(decimals, decimals).format(toUnits(v));
}

/** USD amount: $12,345.67 */
export function fmtUsd(v: Scaled, decimals = 2): string {
  return "$" + nf(decimals, decimals).format(toUnits(v));
}

/** Signed USD with explicit +/-, for PnL: +$1,204.18 / -$88.40 */
export function fmtSignedUsd(v: Scaled, decimals = 2): string {
  const n = toUnits(v);
  const s = nf(decimals, decimals).format(Math.abs(n));
  return `${n >= 0 ? "+" : "-"}$${s}`;
}

/** Price with adaptive precision (markets quote at different scales). */
export function fmtPrice(v: Scaled, decimals = 2): string {
  return "$" + nf(decimals, decimals).format(toUnits(v));
}

