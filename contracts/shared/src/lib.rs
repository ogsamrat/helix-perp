#![no_std]
//! Shared types, fixed-point math, and cross-contract config for the Helix
//! perpetual-futures protocol.
//!
//! ## Fixed-point conventions
//! Every monetary value (margin, notional, PnL, fees, collateral) is an `i128`
//! scaled to **7 decimals** (`PRICE_SCALE` / `USDC_SCALE`), matching the 7-decimal
//! USDC settlement asset. Oracle prices are normalised to the same 7-decimal scale
//! by the `oracle_adapter` regardless of the upstream feed's native precision.
//!
//! The cumulative funding index is tracked at **18 decimals** (`FUNDING_SCALE`) for
//! precision, since per-period funding rates are small fractions of notional.

use soroban_sdk::{contracttype, Address, Symbol};

/// 1e7 — the scale for all USDC-denominated amounts and normalised prices.
pub const PRICE_SCALE: i128 = 10_000_000;
/// 1e7 — alias used at margin/collateral call-sites for readability.
pub const USDC_SCALE: i128 = 10_000_000;
/// 1e4 — basis-point denominator (100% == 10_000 bps).
pub const BPS_DENOM: i128 = 10_000;
/// 1e18 — scale for the cumulative funding index.
pub const FUNDING_SCALE: i128 = 1_000_000_000_000_000_000;

/// Configuration for a single perpetual market. Authored in `market_registry`
/// and read cross-contract by `perp_engine`. Stored verbatim so the engine and
/// the registry agree on the XDR layout via this shared definition.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarketConfig {
    /// Stable numeric id used as the storage / routing key.
    pub id: u32,
    /// Human market symbol, e.g. `XAUPERP`.
    pub symbol: Symbol,
    /// Oracle feed key resolved by the `oracle_adapter`, e.g. `XAU`.
    pub feed: Symbol,
    /// Maximum allowed leverage as an integer multiplier (e.g. 20 == 20x).
    pub max_leverage: u32,
    /// Initial margin ratio in bps (e.g. 500 == 5% == max 20x at entry).
    pub imr_bps: u32,
    /// Maintenance margin ratio in bps (e.g. 250 == 2.5%). Must be < `imr_bps`.
    pub mmr_bps: u32,
    /// Taker fee in bps charged on notional at open and close (e.g. 10 == 0.10%).
    pub taker_fee_bps: u32,
    /// Liquidation penalty in bps of notional, split between keeper + LP.
    pub liquidation_fee_bps: u32,
    /// Maximum aggregate open interest (per side) in notional, 7-dp.
    pub max_oi: i128,
    /// Minimum position notional, 7-dp. Rejects dust positions.
    pub min_position_size: i128,
    /// Per-period funding-rate cap in bps of notional.
    pub max_funding_rate_bps: u32,
    /// Per-market pause flag (independent of the global pause switch).
    pub paused: bool,
}

/// A normalised price returned by `oracle_adapter`, scaled to 7 decimals.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OraclePrice {
    /// Price in USDC terms, scaled to `PRICE_SCALE` (7 dp).
    pub price: i128,
    /// Ledger timestamp (unix seconds) the upstream feed reported.
    pub timestamp: u64,
}

/// Reflector oracle asset selector. The variant names + payloads match the
/// Reflector SEP-40 interface exactly so cross-contract XDR (de)serialises
/// against the live oracle without a custom client.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ReflectorAsset {
    Stellar(Address),
    Other(Symbol),
}

/// Reflector oracle price record (matches Reflector's `PriceData`). `price` is at
/// the oracle's native precision (`decimals()`), normalised downstream by the
/// `oracle_adapter` to `PRICE_SCALE`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReflectorPriceData {
    pub price: i128,
    pub timestamp: u64,
}

/// Position side. Stored as an explicit enum for readable bindings + events.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Side {
    Long,
    Short,
}

// ----------------------------------------------------------------------------
// Fixed-point math. With `overflow-checks = true` (set in the workspace release
// profile and on by default in test builds) every operation here traps on
// overflow rather than wrapping — the fail-safe behaviour we want in a protocol
// that custodies funds.
// ----------------------------------------------------------------------------

/// `floor((a * b) / denom)` with truncation toward zero, in i128. Intended for
/// non-negative `a`/`b`; `denom` must be > 0.
pub fn mul_div(a: i128, b: i128, denom: i128) -> i128 {
    (a * b) / denom
}

/// `amount * bps / 10_000` — apply a basis-point rate to a (signed) amount.
pub fn apply_bps(amount: i128, bps: u32) -> i128 {
    (amount * bps as i128) / BPS_DENOM
}

/// Signed PnL of a position given entry/mark price and side. Result is 7-dp USDC.
///
/// `notional` is the entry notional (always positive). For a long, PnL is
/// `notional * (mark - entry) / entry`; for a short it is the negation.
pub fn position_pnl(notional: i128, entry: i128, mark: i128, side: Side) -> i128 {
    let diff = match side {
        Side::Long => mark - entry,
        Side::Short => entry - mark,
