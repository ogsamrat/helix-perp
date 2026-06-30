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
