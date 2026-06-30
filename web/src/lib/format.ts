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

/** Compact USD: $1.2M, $480.0K */
export function fmtCompactUsd(v: Scaled): string {
  const n = toUnits(v);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

/** Percent from a ratio number (0.0123 -> 1.23%). */
export function fmtPct(ratio: number, decimals = 2): string {
  return `${(ratio * 100).toFixed(decimals)}%`;
}

/** Percent from basis points (125 -> 1.25%). */
export function fmtBps(bps: Scaled, decimals = 2): string {
  return `${(Number(big(bps)) / BPS * 100).toFixed(decimals)}%`;
}

/** Signed percent with +/- prefix. */
export function fmtSignedPct(ratio: number, decimals = 2): string {
  return `${ratio >= 0 ? "+" : ""}${(ratio * 100).toFixed(decimals)}%`;
}

/** Leverage from leverage_bps (100000 -> "10.0x"). */
export function fmtLeverage(leverageBps: Scaled): string {
  return `${(Number(big(leverageBps)) / BPS).toFixed(1)}x`;
}

/** Shorten an address: GBDK…NMKO */
export function shortAddr(addr: string | undefined | null, n = 4): string {
  if (!addr) return "";
  if (addr.length <= n * 2 + 1) return addr;
  return `${addr.slice(0, n)}…${addr.slice(-n)}`;
}

/** A relative "time ago" label from a unix-seconds timestamp. */
export function timeAgo(unixSeconds: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Convert whole USDC units (float) to a 7-dp scaled bigint for contract calls. */
export function toScaled(units: number): bigint {
  return BigInt(Math.round(units * SCALE_NUM));
}
