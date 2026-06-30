import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import type { Side } from "./types";

/** Typed scVal encoders for contract args. */
export const arg = {
  addr: (a: string) => new Address(a).toScVal(),
  u32: (n: number) => nativeToScVal(n, { type: "u32" }),
  u64: (n: number | bigint) => nativeToScVal(BigInt(n), { type: "u64" }),
  i128: (v: bigint) => nativeToScVal(v, { type: "i128" }),
  sym: (s: string) => nativeToScVal(s, { type: "symbol" }),
  str: (s: string) => nativeToScVal(s, { type: "string" }),
  bool: (b: boolean) => xdr.ScVal.scvBool(b),
  /** Unit-variant enum (e.g. Side::Long) -> ScVec([Symbol]). */
  side: (s: Side) => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(s)]),
};

/** Normalise a decoded contracttype enum to its tag string. */
export function tagOf(v: unknown): string {
  if (Array.isArray(v)) return String(v[0]);
  if (v && typeof v === "object" && "tag" in (v as Record<string, unknown>))
    return String((v as Record<string, unknown>).tag);
  return String(v);
}
