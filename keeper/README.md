# Helix Keeper

Off-chain keeper bot for **Helix**, a Soroban perpetual-futures protocol on
Stellar testnet. It is a self-contained TypeScript Node worker that runs on a
loop (default every 60s) and:

1. **Updates funding** — calls `update_funding(keeper, market_id)` on the
   `perp_engine` for each market (`1=XAU`, `2=EUR`, `3=XLM`).
2. **Indexes open positions** — polls `rpc.Server.getEvents` on the
   `perp_engine`. `PositionOpened` adds a position id to an in-memory set;
   `PositionClosed` / `PositionLiquidated` remove it. The last-seen paging
   cursor and the open-id set are persisted to `state.json`, so restarts resume
   instead of re-scanning.
3. **Liquidates underwater positions** — reads `position_view(id)` for each open
   id and, when `equity < maintenance_margin`, calls `liquidate(keeper, id)`.
   The `NotLiquidatable` contract error is handled gracefully (the position
   recovered between indexing and the liquidation attempt).
4. **(Optional) Simulates oracle prices** — when `SIMULATE_PRICES=true`, nudges
   the mock oracle via `set_price(asset, price)` with a small bounded random
   walk around base prices (XAU ~2400, EUR ~1.08, XLM ~0.12), staying within
   ~1% per tick to respect the oracle deviation guard. This keeps the demo UI
   "alive".

Every state-changing call implicitly bumps the TTL of the ledger entries it
touches (via the simulated footprint that `prepareTransaction` assembles).

## Architecture

```
src/
  config.ts    env + ../deploy/testnet.json loading & validation (memoised)
  logger.ts    structured JSON logging + captureError(err, ctx) with a pluggable sink
  stellar.ts   rpc.Server wrapper: read() (simulate+decode), invoke() (prepare→sign→send→poll),
               scval encode/decode helpers
  markets.ts   market id -> { feed symbol, basePrice } and price/decimal scaling
  indexer.ts   getEvents polling -> open-position id set; cursor persistence to state.json
  keeper.ts    runCycle(): price sim → funding → index sync → liquidation scan
  index.ts     entrypoint: loop (setTimeout, non-overlapping) or `once`; graceful shutdown
```

All monetary values are `i128` scaled to 7 decimals on the engine; prices are
normalized to 7dp; the mock oracle's native scale is 14dp. `i128`/`u64` decode
to `bigint` via `scValToNative`, so equity/margin comparisons use `bigint`.

## Requirements

- Node.js 20+ (developed against v24).
- A funded testnet account **registered as a keeper** in the `market_registry`.
  `update_funding` and `liquidate` are keeper-gated (`NotKeeper` otherwise).

## Setup

```bash
cd keeper
pnpm install            # or: npm.cmd install
cp .env.example .env    # then edit .env
```

### Obtaining `KEEPER_SECRET`

The keeper reads its signing secret **only** from the `KEEPER_SECRET`
environment variable — it is never embedded in code or written to disk.

```bash
# Show the secret seed (S...) for a Stellar CLI identity:
stellar keys show <name>

# e.g. if your keeper identity is "deployer":
stellar keys show deployer
```

Put the result in `.env`:

```
KEEPER_SECRET=S................................................................
```

Fund the matching public key on testnet via <https://friendbot.stellar.org> if
needed, and make sure it is the address registered as `keeper` in
`deploy/testnet.json` / the `market_registry`.

Contract addresses are resolved in this order: explicit env var →
`../deploy/testnet.json` → built-in testnet fallbacks. So in this repo you only
need to set `KEEPER_SECRET`.

## Running

```bash
pnpm typecheck   # tsc --noEmit (strict) — must be clean
pnpm dev         # tsx watch, loops every POLL_INTERVAL_MS
pnpm start       # tsx, loops (production-style)
pnpm once        # run exactly one cycle then exit (for cron / CI)
```

`Ctrl-C` (SIGINT) / SIGTERM triggers a graceful shutdown: it stops scheduling
new cycles, lets any in-flight cycle finish, persists `state.json`, then exits.

## Configuration (`.env`)

| Variable                 | Default                                   | Notes                                             |
| ------------------------ | ----------------------------------------- | ------------------------------------------------- |
| `KEEPER_SECRET`          | — (required)                              | Stellar secret seed (`S...`). Never commit it.    |
| `RPC_URL`                | `https://soroban-testnet.stellar.org`     | Soroban RPC endpoint.                             |
| `NETWORK_PASSPHRASE`     | `Test SDF Network ; September 2015`       | Testnet passphrase.                               |
| `PERP_ENGINE_ID`         | from `deploy/testnet.json`                | `perp_engine` contract id.                        |
| `MARKET_REGISTRY_ID`     | from `deploy/testnet.json`                | `market_registry` contract id.                    |
| `MOCK_ORACLE_ID`         | from `deploy/testnet.json`                | `mock_oracle` contract id (for price sim).        |
| `ORACLE_ADAPTER_ID`      | from `deploy/testnet.json`                | `oracle_adapter` contract id.                     |
| `POLL_INTERVAL_MS`       | `60000`                                   | Loop cadence.                                     |
| `SIMULATE_PRICES`        | `false`                                   | `true` to nudge mock-oracle prices each cycle.    |
| `LOG_LEVEL`              | `info`                                    | `debug` \| `info` \| `warn` \| `error`.           |
| `EVENT_LOOKBACK_LEDGERS` | `17280`                                   | Cold-start event lookback window (~24h).          |

## Logging & error tracking

Logs are single-line JSON objects (`{ ts, level, msg, ... }`) — greppable and
ingestible by Datadog/CloudWatch/etc. Errors funnel through
`captureError(err, ctx)` (in `logger.ts`), whose sink is pluggable via
`setErrorSink(...)`; the default logs through the structured logger, but a real
deployment can route to Sentry/Honeycomb without touching call sites.

## Deploying as a cron job

Because `pnpm once` runs a single cycle and exits, the keeper fits any scheduler.

### Vercel Cron

`vercel.json`:

```json
{
  "crons": [{ "path": "/api/keeper", "schedule": "*/1 * * * *" }]
}
```

Have the route invoke a single cycle (set `KEEPER_SECRET` and contract ids as
Vercel project env vars). For a plain serverless function, import and call the
same logic `pnpm once` runs (`keeper.runCycle()`), or shell out to
`tsx src/index.ts once`. Note that liquidation + funding writes need outbound
network access and can take longer than short serverless timeouts — prefer a
long-running worker (a small VM / container running `pnpm start`) for the main
loop, and use cron only as a backstop.

### GitHub Actions

`.github/workflows/keeper.yml`:

```yaml
name: helix-keeper
on:
  schedule:
    - cron: "*/5 * * * *" # every 5 minutes (GitHub's minimum granularity)
  workflow_dispatch:
jobs:
  keep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - working-directory: keeper
        run: pnpm install --frozen-lockfile
      - working-directory: keeper
        env:
          KEEPER_SECRET: ${{ secrets.KEEPER_SECRET }}
          SIMULATE_PRICES: "true"
        run: pnpm once
```

Store the secret as the `KEEPER_SECRET` GitHub Actions secret. Note: GitHub's
scheduler granularity is ~5 minutes and best-effort, and the ephemeral runner
starts cold each time (it re-scans events from `EVENT_LOOKBACK_LEDGERS` unless
you cache `state.json`), so this is best used as a backstop rather than the
primary keeper.

## State file

`state.json` (gitignored) holds the RPC paging cursor and the open-position id
set. Delete it to force a cold re-scan from `EVENT_LOOKBACK_LEDGERS` ago.
