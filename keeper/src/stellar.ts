/**
 * Thin Soroban client wrapper around `rpc.Server`.
 *
 * Provides:
 *   - `read(...)`  : simulate a contract call and decode the return value.
 *   - `invoke(...)`: build → prepare (simulate + auth + fees) → sign → send →
 *                    poll a state-changing contract call.
 *   - scval encode helpers (address / u32 / u64 / i128 / symbol) and
 *     `decode<T>` over `scValToNative`.
 *
 * All RPC quirks (status polling, error extraction, the prepare step that also
 * bumps TTL via the footprint) are contained here so the rest of the keeper
 * deals only in plain values.
 */

import {
  Account,
  Address,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
  rpc,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import type { KeeperConfig } from "./config.js";
import { log } from "./logger.js";

/** A contract error surfaced from a simulation/transaction (e.g. NotLiquidatable). */
export class ContractCallError extends Error {
  readonly raw: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = "ContractCallError";
    this.raw = raw;
  }
}

/** Default transaction timeout (seconds) for the TransactionBuilder. */
const TX_TIMEOUT_SECONDS = 60;

/** Poll cadence + ceiling while waiting for a submitted tx to finalize. */
const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_ATTEMPTS = 30; // ~60s

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class StellarClient {
  readonly server: rpc.Server;
  private readonly keypair: Keypair;
  private readonly networkPassphrase: string;

  constructor(private readonly config: KeeperConfig) {
    // allowHttp lets a local RPC (http://) work; testnet is https so it's inert there.
    this.server = new rpc.Server(config.rpcUrl, {
      allowHttp: config.rpcUrl.startsWith("http://"),
    });
    this.keypair = Keypair.fromSecret(config.keeperSecret);
    this.networkPassphrase = config.networkPassphrase;
  }

  get keeperPublicKey(): string {
    return this.keypair.publicKey();
  }

  // --- scval encode helpers -------------------------------------------------

  static addressScVal(addr: string): xdr.ScVal {
    return new Address(addr).toScVal();
  }

  static u32ScVal(n: number): xdr.ScVal {
    return nativeToScVal(n, { type: "u32" });
  }

  static u64ScVal(n: bigint | number): xdr.ScVal {
    return nativeToScVal(typeof n === "bigint" ? n : BigInt(n), { type: "u64" });
  }

  static i128ScVal(v: bigint | number | string): xdr.ScVal {
    return nativeToScVal(BigInt(v), { type: "i128" });
  }

  static symbolScVal(s: string): xdr.ScVal {
    return nativeToScVal(s, { type: "symbol" });
  }

  /**
   * Encode `ReflectorAsset::Other(Symbol)` as the raw ScVal vec
   * `[Symbol("Other"), Symbol("XAU")]`. The contract's enum variant `Other`
   * carries a single Symbol payload, which is represented on the wire as a vec
   * whose head is the variant-name symbol. Using the explicit `scvVec` form is
   * unambiguous regardless of how `nativeToScVal` would map a tagged object.
   */
  static reflectorOtherScVal(symbol: string): xdr.ScVal {
    return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Other"), xdr.ScVal.scvSymbol(symbol)]);
  }

  // --- reads ----------------------------------------------------------------

  /**
   * Simulate a (read-only) contract call against the current ledger and decode
   * the return value to a native JS value.
   */
  async read<T>(contractId: string, method: string, args: xdr.ScVal[]): Promise<T> {
    const source = await this.buildSourceAccount();
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new ContractCallError(`simulation failed for ${method}: ${sim.error}`, sim.error);
    }
    if (!rpc.Api.isSimulationSuccess(sim) || sim.result === undefined) {
      throw new ContractCallError(
        `simulation for ${method} returned no result`,
        JSON.stringify(sim),
      );
    }
    return scValToNative(sim.result.retval) as T;
  }

  // --- writes ---------------------------------------------------------------

  /**
   * Build, prepare, sign, submit, and confirm a state-changing contract call.
   * `prepareTransaction` performs simulation, assembles required authorizations,
   * sets the soroban resource fee, and writes the footprint (which implicitly
   * bumps the TTL of touched ledger entries on apply).
   *
   * Returns the successful transaction hash. Throws `ContractCallError` if the
   * simulation or the final transaction reports a contract-level error.
   */
  async invoke(contractId: string, method: string, args: xdr.ScVal[]): Promise<string> {
    const source = await this.buildSourceAccount();
