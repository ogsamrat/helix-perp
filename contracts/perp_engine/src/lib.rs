#![no_std]
//! # perp_engine
//!
//! The position manager and cross-contract hub. Every state transition reads
//! market parameters from `market_registry`, a validated price from
//! `oracle_adapter`, and moves money through `collateral_vault` — three live
//! cross-contract calls per trade.
//!
//! ## Accounting model
//! Positions are tracked in **USD notional** (linear perp), so PnL is
//! `notional * (mark − entry) / entry` and is dimensionless in the base asset —
//! which keeps the same engine asset-agnostic across XAU, EUR, XLM, BTC, …
//!
//! Funding is **OI-skew driven** (no separate AMM mark exists for an oracle-priced
//! perp): when longs out-weigh shorts, longs pay shorts, capped at the market's
//! `max_funding_rate_bps` per keeper update. The cumulative funding index is
//! tracked per market at 18-dp; each position records the index at entry and
//! settles the delta on close/modify/liquidation.
//!
//! The LP pool in `collateral_vault` is the counterparty to every position.

use helix_shared::{
    apply_bps, funding_payment, position_pnl, MarketConfig, OraclePrice, Side, BPS_DENOM,
    FUNDING_SCALE,
};
use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, Address, Env, Symbol, Vec,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_AMOUNT: u32 = 45 * DAY_IN_LEDGERS;
const BUMP_THRESHOLD: u32 = 40 * DAY_IN_LEDGERS;

// --------------------------------------------------------- cross-contract clients
// Declared as interface traits (not crate deps) so only client stubs are linked —
// no foreign contract exports leak into this wasm. The arg/return types come from
// `helix_shared`, guaranteeing XDR compatibility with the deployed contracts.

#[contractclient(name = "RegistryClient")]
pub trait Registry {
    fn get_market(e: Env, id: u32) -> MarketConfig;
    fn is_paused(e: Env) -> bool;
    fn is_keeper(e: Env, who: Address) -> bool;
}

#[contractclient(name = "OracleClient")]
pub trait Oracle {
    fn get_price(e: Env, feed: Symbol) -> OraclePrice;
}

#[contractclient(name = "VaultClient")]
pub trait Vault {
    fn lock_margin(e: Env, trader: Address, margin: i128, fee: i128);
    fn add_margin(e: Env, trader: Address, amount: i128);
    fn settle(e: Env, trader: Address, margin: i128, payout: i128);
    fn settle_liquidation(
        e: Env,
        trader: Address,
        keeper: Address,
        margin: i128,
        trader_payout: i128,
        keeper_fee: i128,
    );
    fn realize(e: Env, delta: i128);
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EngineError {
    GlobalPaused = 1,
    MarketPaused = 2,
    PositionNotFound = 3,
    NotOwner = 4,
    BelowMinSize = 5,
    ExceedsMaxLeverage = 6,
    InsufficientMargin = 7,
    ExceedsMaxOi = 8,
    SlippageExceeded = 9,
    NotKeeper = 10,
    NotLiquidatable = 11,
    InvalidAmount = 12,
    PositionUnhealthy = 13,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Position {
    pub id: u64,
    pub owner: Address,
    pub market_id: u32,
    pub side: Side,
    pub margin: i128,
    pub notional: i128,
    pub entry_price: i128,
    pub entry_funding: i128,
    pub opened_at: u64,
}

/// Fully-computed position snapshot for the frontend — equity, PnL, funding,
/// liquidation price, margin ratio — so the UI never re-derives chain math.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PositionView {
    pub id: u64,
    pub owner: Address,
    pub market_id: u32,
    pub side: Side,
    pub margin: i128,
    pub notional: i128,
    pub entry_price: i128,
    pub mark_price: i128,
    pub unrealized_pnl: i128,
    pub funding: i128,
    pub equity: i128,
    pub maintenance_margin: i128,
    pub liquidation_price: i128,
    pub leverage_bps: i128,
    pub margin_ratio_bps: i128,
}

#[contracttype]
pub enum DataKey {
    Registry,
    Oracle,
    Vault,
    NextId,
    Position(u64),
    UserPositions(Address),
    CumFunding(u32),
    LastFundingTs(u32),
    LongOi(u32),
    ShortOi(u32),
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PositionOpened {
    #[topic]
    pub trader: Address,
    #[topic]
    pub market_id: u32,
    pub id: u64,
    pub side: Side,
    pub margin: i128,
    pub notional: i128,
    pub entry_price: i128,
    pub fee: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PositionClosed {
    #[topic]
    pub trader: Address,
    #[topic]
    pub market_id: u32,
    pub id: u64,
    pub exit_price: i128,
    pub realized_pnl: i128,
    pub payout: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PositionModified {
    #[topic]
    pub trader: Address,
    pub id: u64,
    pub kind: Symbol,
    pub margin: i128,
    pub notional: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PositionLiquidated {
    #[topic]
    pub trader: Address,
    #[topic]
    pub keeper: Address,
    pub id: u64,
    pub market_id: u32,
    pub mark_price: i128,
    pub trader_payout: i128,
    pub keeper_fee: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FundingUpdated {
    #[topic]
    pub market_id: u32,
    pub rate_bps: i128,
    pub cumulative: i128,
    pub index_price: i128,
    pub timestamp: u64,
}

#[contract]
pub struct PerpEngine;

#[contractimpl]
impl PerpEngine {
    pub fn __constructor(e: &Env, registry: Address, oracle: Address, vault: Address) {
        e.storage().instance().set(&DataKey::Registry, &registry);
        e.storage().instance().set(&DataKey::Oracle, &oracle);
        e.storage().instance().set(&DataKey::Vault, &vault);
        e.storage().instance().set(&DataKey::NextId, &0u64);
        e.storage()
            .instance()
            .extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
    }

    /// Open a leveraged position. `notional` is the USD size (margin × leverage);
    /// `ref_price`/`max_slippage_bps` bound how far the executed oracle price may
    /// drift from what the user saw (`ref_price = 0` disables the check).
    pub fn open_position(
        e: &Env,
        trader: Address,
        market_id: u32,
        side: Side,
        margin: i128,
        notional: i128,
        ref_price: i128,
        max_slippage_bps: u32,
    ) -> u64 {
        trader.require_auth();
        if margin <= 0 || notional <= 0 {
            panic_with_error!(e, EngineError::InvalidAmount);
        }
        let cfg = Self::market(e, market_id);
        Self::ensure_active(e, &cfg);

        let price = Self::price(e, &cfg);
        Self::check_slippage(e, price.price, ref_price, max_slippage_bps);

        if notional < cfg.min_position_size {
            panic_with_error!(e, EngineError::BelowMinSize);
        }
        if notional > margin * (cfg.max_leverage as i128) {
            panic_with_error!(e, EngineError::ExceedsMaxLeverage);
        }
        if margin < apply_bps(notional, cfg.imr_bps) {
            panic_with_error!(e, EngineError::InsufficientMargin);
        }
        let side_oi = Self::oi(e, market_id, side);
        if side_oi + notional > cfg.max_oi {
            panic_with_error!(e, EngineError::ExceedsMaxOi);
        }

        let fee = apply_bps(notional, cfg.taker_fee_bps);
        Self::vault(e).lock_margin(&trader, &margin, &fee);

        let id = Self::next_id(e);
        let pos = Position {
            id,
            owner: trader.clone(),
            market_id,
            side,
            margin,
            notional,
            entry_price: price.price,
            entry_funding: Self::cum_funding(e, market_id),
            opened_at: e.ledger().timestamp(),
        };
        Self::store_position(e, &pos);
        Self::add_user_position(e, &trader, id);
        Self::set_oi(e, market_id, side, side_oi + notional);
        Self::bump(e);

        PositionOpened {
            trader,
            market_id,
            id,
            side,
            margin,
            notional,
            entry_price: price.price,
            fee,
        }
        .publish(e);
        id
    }

    /// Fully close a position, settling PnL + funding + close fee with the vault.
    pub fn close_position(e: &Env, trader: Address, position_id: u64) {
        let pos = Self::owned_position(e, &trader, position_id);
        let cfg = Self::market(e, pos.market_id);
        let price = Self::price(e, &cfg);

        let pnl = position_pnl(pos.notional, pos.entry_price, price.price, pos.side);
        let funding = funding_payment(
            pos.notional,
            Self::cum_funding(e, pos.market_id),
            pos.entry_funding,
            pos.side,
        );
        let close_fee = apply_bps(pos.notional, cfg.taker_fee_bps);
        let equity = pos.margin + pnl - funding - close_fee;
        let payout = equity.max(0);

        Self::vault(e).settle(&pos.owner, &pos.margin, &payout);
        Self::set_oi(
            e,
            pos.market_id,
            pos.side,
            Self::oi(e, pos.market_id, pos.side) - pos.notional,
        );
        Self::remove_position(e, &pos);

        PositionClosed {
            trader,
            market_id: pos.market_id,
            id: pos.id,
            exit_price: price.price,
            realized_pnl: pnl - funding - close_fee,
            payout,
        }
        .publish(e);
    }

    /// Add collateral to a position (reduces leverage, pushes liq price away).
    pub fn add_margin(e: &Env, trader: Address, position_id: u64, amount: i128) {
        let mut pos = Self::owned_position(e, &trader, position_id);
        if amount <= 0 {
            panic_with_error!(e, EngineError::InvalidAmount);
        }
        Self::vault(e).add_margin(&trader, &amount);
        pos.margin += amount;
        Self::store_position(e, &pos);
        Self::bump(e);
        PositionModified {
            trader,
            id: pos.id,
            kind: Symbol::new(e, "add_margin"),
            margin: pos.margin,
            notional: pos.notional,
        }
        .publish(e);
    }

    /// Withdraw free collateral, provided the position stays above maintenance and
    /// within max leverage afterwards.
    pub fn remove_margin(e: &Env, trader: Address, position_id: u64, amount: i128) {
        let mut pos = Self::owned_position(e, &trader, position_id);
        if amount <= 0 {
            panic_with_error!(e, EngineError::InvalidAmount);
        }
        let new_margin = pos.margin - amount;
        if new_margin <= 0 {
            panic_with_error!(e, EngineError::InvalidAmount);
        }
        let cfg = Self::market(e, pos.market_id);
        let price = Self::price(e, &cfg);
        if pos.notional > new_margin * (cfg.max_leverage as i128) {
            panic_with_error!(e, EngineError::ExceedsMaxLeverage);
        }
        let pnl = position_pnl(pos.notional, pos.entry_price, price.price, pos.side);
        let funding = funding_payment(
            pos.notional,
            Self::cum_funding(e, pos.market_id),
            pos.entry_funding,
            pos.side,
        );
        let equity = new_margin + pnl - funding;
        if equity < apply_bps(pos.notional, cfg.mmr_bps) {
            panic_with_error!(e, EngineError::PositionUnhealthy);
        }

        Self::vault(e).settle(&trader, &amount, &amount);
        pos.margin = new_margin;
        Self::store_position(e, &pos);
        Self::bump(e);
        PositionModified {
            trader,
            id: pos.id,
            kind: Symbol::new(e, "remove_margin"),
            margin: pos.margin,
            notional: pos.notional,
        }
        .publish(e);
    }

    /// Increase position size, pulling `add_margin` + fee and blending the entry
    /// price. Accrued funding is settled first so the new baseline is clean.
    pub fn increase(
        e: &Env,
        trader: Address,
        position_id: u64,
        add_margin: i128,
        add_notional: i128,
        ref_price: i128,
        max_slippage_bps: u32,
    ) {
        let mut pos = Self::owned_position(e, &trader, position_id);
        if add_margin <= 0 || add_notional <= 0 {
            panic_with_error!(e, EngineError::InvalidAmount);
        }
        let cfg = Self::market(e, pos.market_id);
        Self::ensure_active(e, &cfg);
        let price = Self::price(e, &cfg);
        Self::check_slippage(e, price.price, ref_price, max_slippage_bps);

        // Settle funding accrued so far, then re-baseline.
        let funding = funding_payment(
            pos.notional,
            Self::cum_funding(e, pos.market_id),
            pos.entry_funding,
            pos.side,
        );
        if funding >= pos.margin {
            panic_with_error!(e, EngineError::PositionUnhealthy);
        }
        Self::vault(e).realize(&funding);
        pos.margin -= funding;

        let side_oi = Self::oi(e, pos.market_id, pos.side);
        if side_oi + add_notional > cfg.max_oi {
            panic_with_error!(e, EngineError::ExceedsMaxOi);
        }

        let fee = apply_bps(add_notional, cfg.taker_fee_bps);
        Self::vault(e).lock_margin(&trader, &add_margin, &fee);

        let new_notional = pos.notional + add_notional;
        let new_margin = pos.margin + add_margin;
        // Notional-weighted average entry price.
        let new_entry =
            (pos.notional * pos.entry_price + add_notional * price.price) / new_notional;

        if new_notional > new_margin * (cfg.max_leverage as i128) {
            panic_with_error!(e, EngineError::ExceedsMaxLeverage);
        }
        if new_margin < apply_bps(new_notional, cfg.imr_bps) {
            panic_with_error!(e, EngineError::InsufficientMargin);
        }

        pos.notional = new_notional;
        pos.margin = new_margin;
        pos.entry_price = new_entry;
        pos.entry_funding = Self::cum_funding(e, pos.market_id);
        Self::store_position(e, &pos);
        Self::set_oi(e, pos.market_id, pos.side, side_oi + add_notional);
        Self::bump(e);
        PositionModified {
            trader,
            id: pos.id,
            kind: Symbol::new(e, "increase"),
            margin: pos.margin,
            notional: pos.notional,
        }
        .publish(e);
    }

    /// Partially close `close_notional` of a position at the current price.
    pub fn decrease(
        e: &Env,
        trader: Address,
        position_id: u64,
        close_notional: i128,
        ref_price: i128,
        max_slippage_bps: u32,
    ) {
        let mut pos = Self::owned_position(e, &trader, position_id);
        if close_notional <= 0 || close_notional >= pos.notional {
            panic_with_error!(e, EngineError::InvalidAmount);
        }
        let cfg = Self::market(e, pos.market_id);
        let price = Self::price(e, &cfg);
        Self::check_slippage(e, price.price, ref_price, max_slippage_bps);

        // Settle funding on the whole position, re-baseline.
        let funding = funding_payment(
            pos.notional,
            Self::cum_funding(e, pos.market_id),
            pos.entry_funding,
            pos.side,
        );
        if funding >= pos.margin {
            panic_with_error!(e, EngineError::PositionUnhealthy);
        }
        Self::vault(e).realize(&funding);
        pos.margin -= funding;
        pos.entry_funding = Self::cum_funding(e, pos.market_id);

        let closed_margin = pos.margin * close_notional / pos.notional;
        let pnl = position_pnl(close_notional, pos.entry_price, price.price, pos.side);
        let close_fee = apply_bps(close_notional, cfg.taker_fee_bps);
        let payout = (closed_margin + pnl - close_fee).max(0);

        Self::vault(e).settle(&trader, &closed_margin, &payout);
        pos.notional -= close_notional;
        pos.margin -= closed_margin;
        Self::store_position(e, &pos);
        Self::set_oi(
            e,
            pos.market_id,
            pos.side,
            Self::oi(e, pos.market_id, pos.side) - close_notional,
        );
        Self::bump(e);
        PositionModified {
            trader,
            id: pos.id,
            kind: Symbol::new(e, "decrease"),
            margin: pos.margin,
            notional: pos.notional,
        }
        .publish(e);
    }

    /// Liquidate an under-margined position. Keeper-only. The keeper earns a
    /// reward out of the liquidation penalty; any residual equity returns to the
    /// trader and the rest accrues to LPs.
    pub fn liquidate(e: &Env, keeper: Address, position_id: u64) {
        keeper.require_auth();
        if !Self::registry(e).is_keeper(&keeper) {
            panic_with_error!(e, EngineError::NotKeeper);
        }
        let pos = Self::position(e, position_id);
        let cfg = Self::market(e, pos.market_id);
        let price = Self::price(e, &cfg);

        let pnl = position_pnl(pos.notional, pos.entry_price, price.price, pos.side);
        let funding = funding_payment(
            pos.notional,
            Self::cum_funding(e, pos.market_id),
            pos.entry_funding,
            pos.side,
        );
        let equity = pos.margin + pnl - funding;
        let maintenance = apply_bps(pos.notional, cfg.mmr_bps);
        if equity >= maintenance {
            panic_with_error!(e, EngineError::NotLiquidatable);
        }

        let eq_pos = equity.max(0);
        let penalty = apply_bps(pos.notional, cfg.liquidation_fee_bps);
        let keeper_fee = penalty.min(eq_pos);
        let trader_payout = eq_pos - keeper_fee;

        Self::vault(e).settle_liquidation(
            &pos.owner,
            &keeper,
            &pos.margin,
            &trader_payout,
            &keeper_fee,
        );
        Self::set_oi(
            e,
            pos.market_id,
            pos.side,
            Self::oi(e, pos.market_id, pos.side) - pos.notional,
        );
        Self::remove_position(e, &pos);

        PositionLiquidated {
            trader: pos.owner.clone(),
            keeper,
            id: pos.id,
            market_id: pos.market_id,
            mark_price: price.price,
