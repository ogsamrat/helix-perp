import deployment from "./deployment.json";

/**
 * Resolved runtime config. `NEXT_PUBLIC_*` env vars (set on Vercel) win; otherwise
 * we fall back to the committed `deployment.json` so the app works out-of-the-box.
 */
const env = (k: string, fallback: string) =>
  (process.env[k] && process.env[k]!.length > 0 ? process.env[k]! : fallback);

export const CONFIG = {
  network: env("NEXT_PUBLIC_STELLAR_NETWORK", deployment.network),
  rpcUrl: env("NEXT_PUBLIC_RPC_URL", deployment.rpcUrl),
  horizonUrl: env("NEXT_PUBLIC_HORIZON_URL", deployment.horizonUrl),
  networkPassphrase: env("NEXT_PUBLIC_NETWORK_PASSPHRASE", deployment.networkPassphrase),
  explorer: deployment.explorer,
  friendbot: deployment.friendbot,
  contracts: {
    mockUsdc: env("NEXT_PUBLIC_MOCK_USDC_ID", deployment.contracts.mockUsdc),
    mockOracle: env("NEXT_PUBLIC_MOCK_ORACLE_ID", deployment.contracts.mockOracle),
    oracleAdapter: env("NEXT_PUBLIC_ORACLE_ADAPTER_ID", deployment.contracts.oracleAdapter),
    marketRegistry: env("NEXT_PUBLIC_MARKET_REGISTRY_ID", deployment.contracts.marketRegistry),
    collateralVault: env("NEXT_PUBLIC_COLLATERAL_VAULT_ID", deployment.contracts.collateralVault),
    perpEngine: env("NEXT_PUBLIC_PERP_ENGINE_ID", deployment.contracts.perpEngine),
  },
} as const;

export type MarketKind = "Metal" | "FX" | "Crypto";

export interface MarketMeta {
  id: number;
  /** On-chain symbol, e.g. XAUPERP. */
  symbol: string;
  /** Oracle feed key. */
  feed: string;
  /** Display name + ticker. */
  name: string;
  ticker: string;
  base: string;
  quote: string;
  kind: MarketKind;
  /** Short blurb for the markets list. */
  blurb: string;
  /** Price formatting precision hint. */
  priceDecimals: number;
}

/**
 * Display metadata for the listed markets (angle B: FX & tokenized-RWA perps —
