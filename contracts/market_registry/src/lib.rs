#![no_std]
//! # market_registry
//!
//! The protocol controller. It owns:
//! * **Per-market configuration** ([`MarketConfig`]) — leverage caps, margin
//!   ratios, fees, OI caps, funding params — read cross-contract by `perp_engine`.
//! * **Role-based access control** (OpenZeppelin `stellar-access`): a single
//!   `Admin`, plus `keeper` and `pauser` roles. Every privileged action is gated.
//! * **A global pause switch** (OpenZeppelin `stellar-contract-utils::pausable`).
//! * **Upgrade authority** — `upgrade(wasm_hash)` gated to `Admin`.
//!
//! Custody is deliberately *not* here: funds live in `collateral_vault`, trading
//! logic in `perp_engine`. Isolating control from custody means any one contract
//! can be upgraded without touching user balances.

use helix_shared::{MarketConfig, BPS_DENOM};
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env, Symbol, Vec,
};
use stellar_access::access_control::{self, AccessControl};
use stellar_contract_utils::pausable::{self as pausable};
use stellar_macros::{only_admin, only_role};

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_AMOUNT: u32 = 45 * DAY_IN_LEDGERS;
const BUMP_THRESHOLD: u32 = 40 * DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RegistryError {
    MarketNotFound = 1,
    MarketAlreadyExists = 2,
    InvalidConfig = 3,
}

#[contracttype]
pub enum DataKey {
    Market(u32),
    MarketIds,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarketListed {
    #[topic]
    pub id: u32,
    pub symbol: Symbol,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarketUpdated {
    #[topic]
    pub id: u32,
    pub paused: bool,
}

#[contract]
pub struct MarketRegistry;

#[contractimpl]
impl MarketRegistry {
    /// Initialise the controller. `admin` becomes the super-admin (and is granted
    /// both `keeper` and `pauser`); `keeper` is granted the `keeper` role so the
    /// off-chain keeper bot can update funding + liquidate immediately.
    pub fn __constructor(e: &Env, admin: Address, keeper: Address) {
        access_control::set_admin(e, &admin);
        let keeper_role = Symbol::new(e, "keeper");
        let pauser_role = Symbol::new(e, "pauser");
        access_control::grant_role_no_auth(e, &admin, &keeper_role, &admin);
        access_control::grant_role_no_auth(e, &admin, &pauser_role, &admin);
        access_control::grant_role_no_auth(e, &keeper, &keeper_role, &admin);
        e.storage()
            .instance()
            .set(&DataKey::MarketIds, &Vec::<u32>::new(e));
        e.storage()
            .instance()
            .extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
    }

    /// List a new market. Admin only.
    #[only_admin]
    pub fn add_market(e: &Env, cfg: MarketConfig) {
        if e.storage().persistent().has(&DataKey::Market(cfg.id)) {
            panic_with_error!(e, RegistryError::MarketAlreadyExists);
        }
        Self::validate(e, &cfg);
        let mut ids: Vec<u32> = e
            .storage()
            .instance()
            .get(&DataKey::MarketIds)
            .unwrap_or(Vec::new(e));
        ids.push_back(cfg.id);
        e.storage().instance().set(&DataKey::MarketIds, &ids);
        Self::store_market(e, &cfg);
        MarketListed {
            id: cfg.id,
            symbol: cfg.symbol.clone(),
        }
        .publish(e);
    }

    /// Replace an existing market's configuration. Admin only.
    #[only_admin]
    pub fn update_market(e: &Env, cfg: MarketConfig) {
        if !e.storage().persistent().has(&DataKey::Market(cfg.id)) {
            panic_with_error!(e, RegistryError::MarketNotFound);
        }
        Self::validate(e, &cfg);
        Self::store_market(e, &cfg);
        MarketUpdated {
            id: cfg.id,
            paused: cfg.paused,
        }
        .publish(e);
    }

    /// Pause / unpause a single market. Requires the `pauser` role.
    #[only_role(caller, "pauser")]
    pub fn set_market_paused(e: &Env, caller: Address, id: u32, paused: bool) {
        let mut cfg = Self::get_market(e, id);
        cfg.paused = paused;
        Self::store_market(e, &cfg);
        MarketUpdated { id, paused }.publish(e);
    }

    /// Trip the global kill-switch (halts all engine entrypoints). `pauser` role.
    #[only_role(caller, "pauser")]
    pub fn pause(e: &Env, caller: Address) {
        pausable::pause(e);
    }

    /// Release the global kill-switch. `pauser` role.
    #[only_role(caller, "pauser")]
    pub fn unpause(e: &Env, caller: Address) {
        pausable::unpause(e);
    }

    /// Upgrade the contract's WASM. Admin only — the upgrade authority.
    #[only_admin]
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    // ---------------------------------------------------------------- views

    /// Fetch a market's configuration. Panics with `MarketNotFound` if absent.
    pub fn get_market(e: &Env, id: u32) -> MarketConfig {
        e.storage()
            .persistent()
            .get(&DataKey::Market(id))
            .unwrap_or_else(|| panic_with_error!(e, RegistryError::MarketNotFound))
    }

    pub fn has_market(e: &Env, id: u32) -> bool {
        e.storage().persistent().has(&DataKey::Market(id))
    }

    pub fn market_ids(e: &Env) -> Vec<u32> {
        e.storage()
            .instance()
            .get(&DataKey::MarketIds)
            .unwrap_or(Vec::new(e))
    }

    /// All market configs — convenience for the frontend market list.
    pub fn get_all_markets(e: &Env) -> Vec<MarketConfig> {
        let ids = Self::market_ids(e);
        let mut out = Vec::new(e);
        for id in ids.iter() {
            if let Some(cfg) = e
                .storage()
                .persistent()
                .get::<_, MarketConfig>(&DataKey::Market(id))
            {
                out.push_back(cfg);
            }
        }
        out
    }

    /// Global pause state — read by `perp_engine` before any state transition.
    pub fn is_paused(e: &Env) -> bool {
        pausable::paused(e)
    }

    /// Whether `who` holds the `keeper` role — read by `perp_engine.liquidate` and
    /// `update_funding`.
    pub fn is_keeper(e: &Env, who: Address) -> bool {
        access_control::has_role(e, &who, &Symbol::new(e, "keeper")).is_some()
    }

    // ------------------------------------------------------------- internals

    fn store_market(e: &Env, cfg: &MarketConfig) {
        let key = DataKey::Market(cfg.id);
        e.storage().persistent().set(&key, cfg);
        e.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
        e.storage()
            .instance()
            .extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
    }

    fn validate(e: &Env, cfg: &MarketConfig) {
        let ok = cfg.max_leverage >= 1
            && cfg.imr_bps > 0
            && cfg.mmr_bps > 0
            && (cfg.mmr_bps as i128) < (cfg.imr_bps as i128)
            // imr must be consistent with the advertised max leverage (imr >= 1/lev)
            && (cfg.imr_bps as i128) * (cfg.max_leverage as i128) >= BPS_DENOM
            && cfg.taker_fee_bps < 1_000
            && cfg.liquidation_fee_bps < 5_000
            && cfg.max_oi > 0
            && cfg.min_position_size > 0
            && cfg.min_position_size <= cfg.max_oi;
        if !ok {
            panic_with_error!(e, RegistryError::InvalidConfig);
        }
    }
}

/// Expose the full OpenZeppelin AccessControl entrypoints (grant_role, revoke_role,
/// has_role, get_admin, …) so the admin can manage keepers/pausers post-deploy and
/// the frontend can introspect roles.
#[contractimpl(contracttrait)]
impl AccessControl for MarketRegistry {}

#[cfg(test)]
mod test;
