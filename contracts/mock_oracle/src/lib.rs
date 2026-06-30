#![no_std]
//! Mock Reflector-compatible oracle.
//!
//! Implements the subset of the Reflector SEP-40 interface that `oracle_adapter`
//! consumes (`lastprice`, `decimals`) plus admin setters used by tests and the
//! demo seed script. On testnet the `oracle_adapter` can instead point at the
//! real Reflector contract — the wire types are identical (see `helix_shared`).

use helix_shared::{ReflectorAsset, ReflectorPriceData};
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_THRESHOLD: u32 = 25 * DAY_IN_LEDGERS;

#[contracttype]
pub enum DataKey {
    Admin,
    Decimals,
    Price(ReflectorAsset),
}

#[contract]
pub struct MockOracle;

#[contractimpl]
impl MockOracle {
    /// `decimals` mirrors Reflector's native precision (14 on Stellar testnet).
    pub fn __constructor(e: &Env, admin: Address, decimals: u32) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Decimals, &decimals);
    }

    /// Admin: set a feed price using the current ledger timestamp.
    pub fn set_price(e: &Env, asset: ReflectorAsset, price: i128) {
        Self::admin(e).require_auth();
        let ts = e.ledger().timestamp();
        Self::store(e, asset, price, ts);
    }

    /// Admin: set a feed price with an explicit timestamp — used to simulate
    /// stale data in tests and demos.
    pub fn set_price_at(e: &Env, asset: ReflectorAsset, price: i128, timestamp: u64) {
        Self::admin(e).require_auth();
        Self::store(e, asset, price, timestamp);
    }

    // ---- Reflector interface (read side) ----

    /// Latest price record for `asset`, or `None` if unset.
    pub fn lastprice(e: &Env, asset: ReflectorAsset) -> Option<ReflectorPriceData> {
        e.storage().persistent().get(&DataKey::Price(asset))
    }

    /// Native precision of returned prices.
    pub fn decimals(e: &Env) -> u32 {
        e.storage().instance().get(&DataKey::Decimals).unwrap_or(14)
    }

    fn admin(e: &Env) -> Address {
        e.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not set")
    }

    fn store(e: &Env, asset: ReflectorAsset, price: i128, timestamp: u64) {
        let key = DataKey::Price(asset);
        e.storage()
            .persistent()
            .set(&key, &ReflectorPriceData { price, timestamp });
        e.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
        e.storage()
            .instance()
            .extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
    }
}

#[cfg(test)]
mod test;
