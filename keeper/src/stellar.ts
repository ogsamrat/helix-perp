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
