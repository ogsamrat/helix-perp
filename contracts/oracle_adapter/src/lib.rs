#![no_std]
//! # oracle_adapter
//!
//! A thin, swappable price abstraction in front of the [Reflector](https://reflector.network)
//! decentralised oracle. It exists so the rest of the protocol depends on a stable
//! interface (`get_price(feed) -> OraclePrice` normalised to 7 decimals) regardless
//! of the upstream feed (Reflector today; Pyth/DIA tomorrow — just redeploy this
//! contract).
//!
//! ## Safety guards (learned from the Feb-2026 Stellar oracle exploit)
//! Every price returned by [`get_price`](OracleAdapter::get_price) must pass:
//! 1. **Positivity** — a non-zero, positive price (`InvalidPrice` otherwise).
//! 2. **Freshness** — `now - timestamp <= max_age` (`StalePrice` otherwise).
//! 3. **Deviation bound** — within `max_deviation_bps` of the last accepted price
//!    (`PriceDeviationTooHigh` otherwise), which neutralises single-tick spoofing.
//!
//! All three surface as typed contract errors so callers (and the UI) can react.

use helix_shared::{OraclePrice, ReflectorAsset, ReflectorPriceData, BPS_DENOM, PRICE_SCALE};
use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error, Address,
    Env, Symbol,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_THRESHOLD: u32 = 25 * DAY_IN_LEDGERS;

/// The subset of the Reflector SEP-40 oracle interface this adapter consumes.
/// `#[contractclient]` generates `ReflectorClient` for cross-contract calls; the
/// argument/return types come from `helix_shared` so the XDR matches Reflector.
#[contractclient(name = "ReflectorClient")]
pub trait ReflectorOracle {
    fn lastprice(e: Env, asset: ReflectorAsset) -> Option<ReflectorPriceData>;
    fn decimals(e: Env) -> u32;
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum OracleError {
    /// No `ReflectorAsset` is mapped for the requested feed key.
    FeedNotFound = 1,
    /// Upstream oracle has no price record for the mapped asset.
    NoPriceData = 2,
    /// Price is zero or negative.
    InvalidPrice = 3,
    /// Price timestamp is older than `max_age` seconds.
    StalePrice = 4,
    /// Price deviates from the last accepted price beyond `max_deviation_bps`.
    PriceDeviationTooHigh = 5,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Reflector,
    OracleDecimals,
    MaxAge,
    MaxDeviationBps,
    Feed(Symbol),
    Last(Symbol),
}

#[contract]
pub struct OracleAdapter;

#[contractimpl]
impl OracleAdapter {
    /// Initialise the adapter.
    /// * `reflector` — address of the upstream oracle contract.
    /// * `max_age` — maximum accepted price age, in seconds.
    /// * `max_deviation_bps` — maximum tick-to-tick deviation, in bps.
    pub fn __constructor(
        e: &Env,
        admin: Address,
        reflector: Address,
        max_age: u64,
        max_deviation_bps: u32,
    ) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Reflector, &reflector);
        e.storage().instance().set(&DataKey::MaxAge, &max_age);
        e.storage()
            .instance()
            .set(&DataKey::MaxDeviationBps, &max_deviation_bps);
        let decimals = ReflectorClient::new(e, &reflector).decimals();
        e.storage()
            .instance()
            .set(&DataKey::OracleDecimals, &decimals);
    }
