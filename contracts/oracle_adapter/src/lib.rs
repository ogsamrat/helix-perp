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

    /// Map a protocol feed key (e.g. `XAU`) to a Reflector asset selector.
    pub fn set_feed(e: &Env, feed: Symbol, asset: ReflectorAsset) {
        Self::admin(e).require_auth();
        e.storage()
            .persistent()
            .set(&DataKey::Feed(feed.clone()), &asset);
        e.storage()
            .persistent()
            .extend_ttl(&DataKey::Feed(feed), BUMP_THRESHOLD, BUMP_AMOUNT);
        Self::bump_instance(e);
    }

    /// Remove a feed mapping.
    pub fn remove_feed(e: &Env, feed: Symbol) {
        Self::admin(e).require_auth();
        e.storage().persistent().remove(&DataKey::Feed(feed));
        Self::bump_instance(e);
    }

    /// Swap the upstream oracle (Reflector -> Pyth/DIA). Re-caches its precision.
    pub fn set_reflector(e: &Env, reflector: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Reflector, &reflector);
        let decimals = ReflectorClient::new(e, &reflector).decimals();
        e.storage()
            .instance()
            .set(&DataKey::OracleDecimals, &decimals);
        Self::bump_instance(e);
    }

    /// Update the freshness / deviation guard parameters.
    pub fn set_guards(e: &Env, max_age: u64, max_deviation_bps: u32) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::MaxAge, &max_age);
        e.storage()
            .instance()
            .set(&DataKey::MaxDeviationBps, &max_deviation_bps);
        Self::bump_instance(e);
    }

    /// Transfer adapter admin.
    pub fn set_admin(e: &Env, new_admin: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    /// Fetch, validate, normalise, and record a price for `feed`.
    ///
    /// Permissionless: anyone may refresh the cached price, but the value is fully
    /// determined by the upstream oracle and the safety guards — there is no way to
    /// inject an arbitrary price. Returns a 7-decimal [`OraclePrice`].
    pub fn get_price(e: &Env, feed: Symbol) -> OraclePrice {
        let asset: ReflectorAsset = e
            .storage()
            .persistent()
            .get(&DataKey::Feed(feed.clone()))
            .unwrap_or_else(|| panic_with_error!(e, OracleError::FeedNotFound));

        let reflector: Address = e.storage().instance().get(&DataKey::Reflector).unwrap();
        let raw: ReflectorPriceData = ReflectorClient::new(e, &reflector)
            .lastprice(&asset)
            .unwrap_or_else(|| panic_with_error!(e, OracleError::NoPriceData));

        // Guard 1: positivity.
        if raw.price <= 0 {
            panic_with_error!(e, OracleError::InvalidPrice);
        }

        // Guard 2: freshness.
        let max_age: u64 = e.storage().instance().get(&DataKey::MaxAge).unwrap();
        let now = e.ledger().timestamp();
        if now > raw.timestamp && now - raw.timestamp > max_age {
            panic_with_error!(e, OracleError::StalePrice);
        }

        // Normalise upstream precision -> 7 dp.
        let price = Self::normalize(e, raw.price);

        // Guard 3: deviation from the last accepted price.
        let max_dev: u32 = e
            .storage()
            .instance()
            .get(&DataKey::MaxDeviationBps)
            .unwrap();
        if let Some(last) = e
            .storage()
            .persistent()
            .get::<_, OraclePrice>(&DataKey::Last(feed.clone()))
        {
            let diff = (price - last.price).abs();
            let dev_bps = diff * BPS_DENOM / last.price;
            if dev_bps > max_dev as i128 {
                panic_with_error!(e, OracleError::PriceDeviationTooHigh);
            }
        }

        let out = OraclePrice {
            price,
            timestamp: raw.timestamp,
        };
        e.storage()
            .persistent()
            .set(&DataKey::Last(feed.clone()), &out);
        e.storage()
            .persistent()
            .extend_ttl(&DataKey::Last(feed), BUMP_THRESHOLD, BUMP_AMOUNT);
        Self::bump_instance(e);
        out
    }

    // ---- views ----

    /// Last accepted normalised price for `feed`, if any.
    pub fn last_price(e: &Env, feed: Symbol) -> Option<OraclePrice> {
        e.storage().persistent().get(&DataKey::Last(feed))
    }

    /// The Reflector asset mapped to `feed`, if any.
    pub fn feed_asset(e: &Env, feed: Symbol) -> Option<ReflectorAsset> {
        e.storage().persistent().get(&DataKey::Feed(feed))
    }

    pub fn reflector(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Reflector).unwrap()
    }

    pub fn max_age(e: &Env) -> u64 {
        e.storage().instance().get(&DataKey::MaxAge).unwrap()
    }

    pub fn max_deviation_bps(e: &Env) -> u32 {
        e.storage()
            .instance()
            .get(&DataKey::MaxDeviationBps)
            .unwrap()
    }

    pub fn oracle_decimals(e: &Env) -> u32 {
        e.storage()
            .instance()
            .get(&DataKey::OracleDecimals)
            .unwrap()
    }

    // ---- internals ----

    fn admin(e: &Env) -> Address {
        e.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not set")
    }

    /// Convert an upstream price at `OracleDecimals` precision to 7 dp.
    fn normalize(e: &Env, raw: i128) -> i128 {
        let dec: u32 = e
            .storage()
            .instance()
            .get(&DataKey::OracleDecimals)
            .unwrap();
        if dec >= 7 {
            let factor = 10i128.pow(dec - 7);
            raw / factor
        } else {
            let factor = 10i128.pow(7 - dec);
            raw * factor
        }
    }

    fn bump_instance(e: &Env) {
        e.storage()
            .instance()
            .extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
    }
}

/// Re-exported constant for callers/tests that want the normalised scale.
pub const NORMALIZED_SCALE: i128 = PRICE_SCALE;

#[cfg(test)]
mod test;
