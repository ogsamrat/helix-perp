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
