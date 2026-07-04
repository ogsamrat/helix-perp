/**
 * Configuration loading + validation.
 *
 * Precedence for contract addresses:
 *   1. explicit environment variable (e.g. PERP_ENGINE_ID)
 *   2. ../deploy/testnet.json (the deploy artefact), if present
 *   3. hard-coded testnet fallbacks
 *
 * The signing secret (KEEPER_SECRET) is ONLY ever read from the environment and
 * is never logged or persisted.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import { Keypair } from "@stellar/stellar-sdk";
import { log } from "./logger.js";
import { DEFAULT_REFLECTOR_ORACLE } from "./reflector.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from the keeper directory (src/.. -> keeper/.env), if it exists.
dotenv.config({ path: resolve(__dirname, "..", ".env") });

/** Default testnet addresses, used when nothing else supplies them. */
const FALLBACK_CONTRACTS = {
  perpEngineId: "CCNRZNFFDPY7Y2YNVTLT6RLCHIRHAX5D3B5TX7F2J3PBPO6FEKNBF3RU",
  marketRegistryId: "CBKYVMWPQB7R3NXBJ45HVRZMIXFJ2NMRALCHLQHSVQY3MGN7D57SQZXL",
  mockOracleId: "CCIQ2IQLXN576DBZDLP6GKBBWQVYAZN2JHBGM4QQHFSVGBBKRK7W6WYZ",
  oracleAdapterId: "CCMYNSD7ZYZVVFRRNNKSSMKQQTUDXBO3TCL6GBGMF4GKIFYBCK6IMQAW",
} as const;

const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";
const DEFAULT_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const DEFAULT_EVENT_LOOKBACK_LEDGERS = 17_280; // ~24h at 5s ledgers.

export interface KeeperConfig {
  readonly keeperSecret: string;
  readonly keeperPublicKey: string;
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
  readonly perpEngineId: string;
  readonly marketRegistryId: string;
  readonly mockOracleId: string;
  readonly oracleAdapterId: string;
  readonly pollIntervalMs: number;
  readonly simulatePrices: boolean;
  /** Relay real prices from the Reflector oracle into the protocol oracle. */
  readonly relayReflector: boolean;
  /** Address of the upstream Reflector oracle to read from. */
  readonly reflectorOracleId: string;
  readonly eventLookbackLedgers: number;
  /** Absolute path to the on-disk cursor/open-id state file. */
  readonly statePath: string;
}

interface DeployArtifact {
  contracts?: {
    perp_engine?: string;
    market_registry?: string;
    mock_oracle?: string;
    oracle_adapter?: string;
  };
}

function readDeployArtifact(): DeployArtifact["contracts"] {
  // keeper/src -> repo root is ../../ ; deploy file lives at ../deploy/testnet.json
  // relative to the keeper dir, i.e. <repo>/deploy/testnet.json.
  const candidate = resolve(__dirname, "..", "..", "deploy", "testnet.json");
  try {
    const raw = readFileSync(candidate, "utf8");
    const parsed = JSON.parse(raw) as DeployArtifact;
    if (parsed.contracts) {
      log.debug("loaded deploy artifact", { path: candidate });
      return parsed.contracts;
    }
    return undefined;
  } catch {
    // Missing or unreadable artefact is fine; we fall back to env/defaults.
    return undefined;
  }
}

function pickContractId(
  envValue: string | undefined,
  deployValue: string | undefined,
  fallback: string,
  name: string,
): string {
  const value = (envValue ?? deployValue ?? fallback).trim();
  if (!isValidContractId(value)) {
    throw new Error(`Invalid contract id for ${name}: "${value}" (expected a C... strkey)`);
  }
  return value;
}

function isValidContractId(value: string): boolean {
  return /^C[A-Z2-7]{55}$/.test(value);
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

function parsePositiveInt(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer, got "${value}"`);
  }
  return n;
}

let cached: KeeperConfig | undefined;

/**
 * Load + validate config. The result is memoised so repeated imports are cheap
 * and validation runs exactly once.
 */
export function loadConfig(): KeeperConfig {
  if (cached) return cached;

  const env = process.env;
  const deploy = readDeployArtifact();

  const keeperSecret = (env.KEEPER_SECRET ?? "").trim();
  if (keeperSecret === "") {
    throw new Error(
      "KEEPER_SECRET is required. Set it in the environment (e.g. `stellar keys show <name>`). " +
        "Never commit it.",
    );
  }

  let keeperPublicKey: string;
  try {
    keeperPublicKey = Keypair.fromSecret(keeperSecret).publicKey();
  } catch (err) {
    throw new Error(
      `KEEPER_SECRET is not a valid Stellar secret seed: ${(err as Error).message}`,
    );
  }

  const config: KeeperConfig = {
    keeperSecret,
    keeperPublicKey,
    rpcUrl: (env.RPC_URL ?? DEFAULT_RPC_URL).trim(),
    networkPassphrase: (env.NETWORK_PASSPHRASE ?? DEFAULT_NETWORK_PASSPHRASE).trim(),
    perpEngineId: pickContractId(
      env.PERP_ENGINE_ID,
      deploy?.perp_engine,
      FALLBACK_CONTRACTS.perpEngineId,
      "PERP_ENGINE_ID",
    ),
    marketRegistryId: pickContractId(
      env.MARKET_REGISTRY_ID,
      deploy?.market_registry,
      FALLBACK_CONTRACTS.marketRegistryId,
      "MARKET_REGISTRY_ID",
    ),
    mockOracleId: pickContractId(
      env.MOCK_ORACLE_ID,
      deploy?.mock_oracle,
      FALLBACK_CONTRACTS.mockOracleId,
      "MOCK_ORACLE_ID",
    ),
    oracleAdapterId: pickContractId(
      env.ORACLE_ADAPTER_ID,
      deploy?.oracle_adapter,
      FALLBACK_CONTRACTS.oracleAdapterId,
      "ORACLE_ADAPTER_ID",
    ),
    pollIntervalMs: parsePositiveInt(env.POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS, "POLL_INTERVAL_MS"),
    simulatePrices: parseBool(env.SIMULATE_PRICES, false),
    relayReflector: parseBool(env.RELAY_REFLECTOR, false),
    reflectorOracleId: (env.REFLECTOR_ORACLE_ID ?? DEFAULT_REFLECTOR_ORACLE).trim(),
    eventLookbackLedgers: parsePositiveInt(
      env.EVENT_LOOKBACK_LEDGERS,
      DEFAULT_EVENT_LOOKBACK_LEDGERS,
      "EVENT_LOOKBACK_LEDGERS",
    ),
    statePath: resolve(__dirname, "..", "state.json"),
  };

  cached = config;
  return config;
}

/** Redacted view of config that is safe to log (no secret). */
export function redactedConfig(c: KeeperConfig): Record<string, unknown> {
  return {
    keeperPublicKey: c.keeperPublicKey,
    rpcUrl: c.rpcUrl,
    networkPassphrase: c.networkPassphrase,
    perpEngineId: c.perpEngineId,
    marketRegistryId: c.marketRegistryId,
    mockOracleId: c.mockOracleId,
    oracleAdapterId: c.oracleAdapterId,
    pollIntervalMs: c.pollIntervalMs,
    simulatePrices: c.simulatePrices,
    relayReflector: c.relayReflector,
    reflectorOracleId: c.reflectorOracleId,
    eventLookbackLedgers: c.eventLookbackLedgers,
    statePath: c.statePath,
  };
}
