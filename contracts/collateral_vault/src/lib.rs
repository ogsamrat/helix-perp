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
        Self::set_total_shares(e, total_shares + shares);
        Self::add_shares(e, &from, shares);
        Self::bump(e);
        LiquidityAdded {
            provider: from,
            amount,
            shares,
        }
        .publish(e);
        shares
    }

    /// Redeem `shares` for the pro-rata amount of `lp_cash`. Returns USDC out.
    pub fn remove_liquidity(e: &Env, from: Address, shares: i128) -> i128 {
        from.require_auth();
        if shares <= 0 {
            panic_with_error!(e, VaultError::InvalidAmount);
        }
        let owned = Self::shares_of(e, from.clone());
        if owned < shares {
            panic_with_error!(e, VaultError::InsufficientShares);
        }
        let lp_cash = Self::lp_cash(e);
        let total_shares = Self::total_shares(e);
        let amount = (shares * lp_cash) / total_shares;

        Self::set_lp_cash(e, lp_cash - amount);
        Self::set_total_shares(e, total_shares - shares);
        Self::add_shares(e, &from, -shares);
        Self::token(e).transfer(&e.current_contract_address(), &from, &amount);
        Self::bump(e);
        LiquidityRemoved {
            provider: from,
            amount,
            shares,
        }
        .publish(e);
        amount
    }

    // ----------------------------------------------------- engine-only custody

    /// Pull `margin` + `fee` from a trader on position open. Margin is locked in
    /// `margin_pool`; the open fee accrues to LPs. Engine only.
    pub fn lock_margin(e: &Env, trader: Address, margin: i128, fee: i128) {
        Self::require_engine(e);
        if margin <= 0 || fee < 0 {
            panic_with_error!(e, VaultError::InvalidAmount);
        }
        Self::token(e).transfer(&trader, &e.current_contract_address(), &(margin + fee));
        Self::set_margin_pool(e, Self::margin_pool(e) + margin);
        Self::set_lp_cash(e, Self::lp_cash(e) + fee);
        Self::bump(e);
        MarginLocked {
            trader,
            margin,
            fee,
        }
        .publish(e);
    }

    /// Pull additional `amount` of margin into an existing position. Engine only.
    pub fn add_margin(e: &Env, trader: Address, amount: i128) {
        Self::require_engine(e);
        if amount <= 0 {
            panic_with_error!(e, VaultError::InvalidAmount);
        }
        Self::token(e).transfer(&trader, &e.current_contract_address(), &amount);
        Self::set_margin_pool(e, Self::margin_pool(e) + amount);
        Self::bump(e);
    }

    /// Settle a position close/decrease: release `margin` from the pool and pay
    /// `payout` to the trader, with the net (payout − margin) flowing from/to LPs.
    /// Engine only.
    pub fn settle(e: &Env, trader: Address, margin: i128, payout: i128) {
        Self::require_engine(e);
        Self::move_pools(e, margin, payout);
        if payout > 0 {
            Self::token(e).transfer(&e.current_contract_address(), &trader, &payout);
        }
        Self::bump(e);
        Settled {
            trader,
            margin,
            payout,
        }
        .publish(e);
    }

    /// Settle a liquidation: release `margin`, pay the trader the residual and the
    /// keeper its reward; the remainder accrues to LPs. Engine only.
    pub fn settle_liquidation(
        e: &Env,
        trader: Address,
        keeper: Address,
        margin: i128,
        trader_payout: i128,
        keeper_fee: i128,
    ) {
        Self::require_engine(e);
        if trader_payout < 0 || keeper_fee < 0 {
            panic_with_error!(e, VaultError::InvalidAmount);
        }
        Self::move_pools(e, margin, trader_payout + keeper_fee);
        if trader_payout > 0 {
            Self::token(e).transfer(&e.current_contract_address(), &trader, &trader_payout);
        }
        if keeper_fee > 0 {
            Self::token(e).transfer(&e.current_contract_address(), &keeper, &keeper_fee);
        }
        Self::bump(e);
        Settled {
            trader,
            margin,
            payout: trader_payout,
        }
        .publish(e);
    }

    /// Route a signed `delta` between the margin pool and LP cash *without* moving
    /// tokens — used by the engine to settle accrued funding on `increase`/
    /// `decrease`. `delta > 0`: trader pays (margin → LP); `delta < 0`: trader
    /// receives (LP → margin). Engine only.
    pub fn realize(e: &Env, delta: i128) {
        Self::require_engine(e);
        if delta == 0 {
            return;
        }
        let margin_pool = Self::margin_pool(e);
        let lp_cash = Self::lp_cash(e);
        if delta > 0 {
            if margin_pool < delta {
                panic_with_error!(e, VaultError::AccountingError);
            }
            Self::set_margin_pool(e, margin_pool - delta);
            Self::set_lp_cash(e, lp_cash + delta);
