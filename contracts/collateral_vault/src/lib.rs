#![no_std]
//! # collateral_vault
//!
//! Single custody contract for the whole protocol. It holds the USDC settlement
//! asset for **two logical pools**:
//! * `margin_pool` — collateral locked behind open trader positions (a liability
//!   to traders).
//! * `lp_cash` — liquidity provided by LPs, which acts as the **counterparty** to
//!   every position. All realised PnL, funding, and fees flow into/out of `lp_cash`.
//!
//! LP shares follow the OpenZeppelin / ERC-4626 pattern: `shares = amount *
//! totalShares / totalAssets` on deposit, redeemed pro-rata. Share price is
//! `lp_cash / totalShares` (cash accounting — unrealised trader PnL is only marked
//! against LPs when a position settles; documented trade-off).
//!
//! **Custody isolation:** the mutating collateral entrypoints are callable *only*
//! by `perp_engine` (enforced via `engine.require_auth()`, auto-satisfied when the
//! engine is the direct caller and impossible to forge otherwise). The vault never
//! contains trading logic — it just moves money when the engine tells it to.

use helix_shared::PRICE_SCALE;
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    token::TokenClient, Address, Env,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_AMOUNT: u32 = 45 * DAY_IN_LEDGERS;
const BUMP_THRESHOLD: u32 = 40 * DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultError {
    EngineAlreadySet = 1,
    EngineNotSet = 2,
    InvalidAmount = 3,
    InsufficientShares = 4,
    /// LP pool cannot cover a requested payout — the vault refuses to pay more
    /// than it holds, protecting solvency.
    InsufficientLiquidity = 5,
    /// Internal accounting invariant violated (would only fire on a logic bug).
    AccountingError = 6,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    Engine,
    LpCash,
    MarginPool,
    TotalShares,
    Shares(Address),
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LiquidityAdded {
    #[topic]
    pub provider: Address,
    pub amount: i128,
    pub shares: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LiquidityRemoved {
    #[topic]
    pub provider: Address,
    pub amount: i128,
    pub shares: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarginLocked {
    #[topic]
    pub trader: Address,
    pub margin: i128,
    pub fee: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Settled {
    #[topic]
    pub trader: Address,
    pub margin: i128,
    pub payout: i128,
}

#[contract]
pub struct CollateralVault;

#[contractimpl]
impl CollateralVault {
    pub fn __constructor(e: &Env, admin: Address, token: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Token, &token);
        e.storage().instance().set(&DataKey::LpCash, &0i128);
        e.storage().instance().set(&DataKey::MarginPool, &0i128);
        e.storage().instance().set(&DataKey::TotalShares, &0i128);
        e.storage()
            .instance()
            .extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
    }

    /// One-time wiring of the authorised `perp_engine`. Admin only; locks after the
    /// first call so the engine cannot be swapped to drain custody.
    pub fn set_engine(e: &Env, engine: Address) {
        Self::admin(e).require_auth();
        if e.storage().instance().has(&DataKey::Engine) {
            panic_with_error!(e, VaultError::EngineAlreadySet);
        }
        e.storage().instance().set(&DataKey::Engine, &engine);
    }

    // ------------------------------------------------------------ LP actions

    /// Deposit `amount` USDC as liquidity, minting LP shares. Returns shares minted.
    pub fn add_liquidity(e: &Env, from: Address, amount: i128) -> i128 {
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(e, VaultError::InvalidAmount);
        }
        Self::token(e).transfer(&from, &e.current_contract_address(), &amount);

        let lp_cash = Self::lp_cash(e);
        let total_shares = Self::total_shares(e);
        let shares = if total_shares == 0 || lp_cash == 0 {
            amount
        } else {
            (amount * total_shares) / lp_cash
        };

        Self::set_lp_cash(e, lp_cash + amount);
