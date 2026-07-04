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
    OrderNotFound = 14,
    NotOrderOwner = 15,
    /// The order's trigger condition is not met at the current price.
    OrderNotTriggerable = 16,
    /// Trigger price / parameters are invalid.
    InvalidTrigger = 17,
}

/// Direction a conditional order triggers in, relative to its `trigger_price`.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TriggerDir {
    /// Fires when the mark price rises to or above `trigger_price`.
    Above,
    /// Fires when the mark price falls to or below `trigger_price`.
    Below,
}

/// A resting conditional order, executed by the keeper when its price trigger is
/// crossed. Two shapes share one type, discriminated by `reduce`:
/// * **entry** (`reduce == false`): opens a new position; `margin` + fee are
///   escrowed with the vault at placement, so execution needs no trader signature.
/// * **reduce / stop** (`reduce == true`): closes `reduce_position` (stop-loss /
///   take-profit); no escrow — it settles the existing position's margin.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Order {
    pub id: u64,
    pub owner: Address,
    pub market_id: u32,
    pub side: Side,
    pub margin: i128,
    pub notional: i128,
    pub trigger_price: i128,
    pub dir: TriggerDir,
    /// `false` = entry (open) order; `true` = stop that closes `reduce_position`.
    pub reduce: bool,
    /// The position id this stop closes (only meaningful when `reduce`).
    pub reduce_position: u64,
    pub max_slippage_bps: u32,
    pub created_at: u64,
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
    NextOrderId,
    Order(u64),
    UserOrders(Address),
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

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OrderPlaced {
    #[topic]
    pub trader: Address,
    #[topic]
    pub market_id: u32,
    pub id: u64,
    pub kind: Symbol,
    pub trigger_price: i128,
    pub notional: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OrderCancelled {
    #[topic]
    pub trader: Address,
    pub id: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OrderFilled {
    #[topic]
    pub trader: Address,
    #[topic]
    pub keeper: Address,
    pub id: u64,
    pub position_id: u64,
    pub fill_price: i128,
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

        // Validate sizing *before* moving any funds, then escrow + materialise.
        Self::validate_sizing(e, market_id, side, margin, notional, &cfg);
        let fee = apply_bps(notional, cfg.taker_fee_bps);
        Self::vault(e).lock_margin(&trader, &margin, &fee);
        Self::create_position(
            e,
            &trader,
            market_id,
            side,
            margin,
            notional,
            price.price,
            fee,
        )
    }

    /// Sizing invariants shared by `open_position` and `execute_order`, checked
    /// against live open interest before any collateral moves.
    fn validate_sizing(
        e: &Env,
        market_id: u32,
        side: Side,
        margin: i128,
        notional: i128,
        cfg: &MarketConfig,
    ) {
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
    }

    /// Write a validated position record, assuming `margin` (+ fee) is already
    /// escrowed with the vault. Callers must `validate_sizing` first.
    fn create_position(
        e: &Env,
        trader: &Address,
        market_id: u32,
        side: Side,
        margin: i128,
        notional: i128,
        price: i128,
        fee: i128,
    ) -> u64 {
        let side_oi = Self::oi(e, market_id, side);
        let id = Self::next_id(e);
        let pos = Position {
            id,
            owner: trader.clone(),
            market_id,
            side,
            margin,
            notional,
            entry_price: price,
            entry_funding: Self::cum_funding(e, market_id),
            opened_at: e.ledger().timestamp(),
        };
        Self::store_position(e, &pos);
        Self::add_user_position(e, trader, id);
        Self::set_oi(e, market_id, side, side_oi + notional);
        Self::bump(e);

        PositionOpened {
            trader: trader.clone(),
            market_id,
            id,
            side,
            margin,
            notional,
            entry_price: price,
            fee,
        }
        .publish(e);
        id
    }

    /// Fully close a position, settling PnL + funding + close fee with the vault.
    pub fn close_position(e: &Env, trader: Address, position_id: u64) {
        let pos = Self::owned_position(e, &trader, position_id);
        Self::close_internal(e, &pos);
    }

    /// Close math + settlement for a position, independent of who triggered it —
    /// shared by `close_position` (owner) and `execute_order` (keeper stop).
    fn close_internal(e: &Env, pos: &Position) {
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
        Self::remove_position(e, pos);

        PositionClosed {
            trader: pos.owner.clone(),
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
            trader_payout,
            keeper_fee,
        }
        .publish(e);
    }

    /// Keeper: advance a market's funding index based on open-interest skew.
    pub fn update_funding(e: &Env, keeper: Address, market_id: u32) -> i128 {
        keeper.require_auth();
        if !Self::registry(e).is_keeper(&keeper) {
            panic_with_error!(e, EngineError::NotKeeper);
        }
        let cfg = Self::market(e, market_id);
        let index = Self::price(e, &cfg);

        let long = Self::oi(e, market_id, Side::Long);
        let short = Self::oi(e, market_id, Side::Short);
        let total = long + short;
        // Skew-driven funding rate, naturally bounded to ±max_funding_rate_bps.
        let rate_bps = if total == 0 {
            0
        } else {
            (long - short) * (cfg.max_funding_rate_bps as i128) / total
        };
        // bps -> 1e18 fraction.
        let rate_frac = rate_bps * (FUNDING_SCALE / BPS_DENOM);
        let cum = Self::cum_funding(e, market_id) + rate_frac;
        e.storage()
            .persistent()
            .set(&DataKey::CumFunding(market_id), &cum);
        e.storage()
            .persistent()
            .set(&DataKey::LastFundingTs(market_id), &e.ledger().timestamp());
        e.storage().persistent().extend_ttl(
            &DataKey::CumFunding(market_id),
            BUMP_THRESHOLD,
            BUMP_AMOUNT,
        );
        Self::bump(e);

        FundingUpdated {
            market_id,
            rate_bps,
            cumulative: cum,
            index_price: index.price,
            timestamp: e.ledger().timestamp(),
        }
        .publish(e);
        rate_bps
    }

    // ----------------------------------------------------------- conditional orders

    /// Place a resting **entry** (limit) order. Margin + the taker fee are escrowed
    /// with the vault immediately, so the keeper can fill it later without a trader
    /// signature. Fires when the mark price crosses `trigger_price` in `dir`.
    pub fn place_order(
        e: &Env,
        trader: Address,
        market_id: u32,
        side: Side,
        margin: i128,
        notional: i128,
        trigger_price: i128,
        dir: TriggerDir,
        max_slippage_bps: u32,
    ) -> u64 {
        trader.require_auth();
        if margin <= 0 || notional <= 0 {
            panic_with_error!(e, EngineError::InvalidAmount);
        }
        if trigger_price <= 0 {
            panic_with_error!(e, EngineError::InvalidTrigger);
        }
        let cfg = Self::market(e, market_id);
        Self::ensure_active(e, &cfg);
        // Sanity-check sizing up front (re-checked at the execution price on fill).
        Self::validate_sizing(e, market_id, side, margin, notional, &cfg);

        let fee = apply_bps(notional, cfg.taker_fee_bps);
        Self::vault(e).lock_margin(&trader, &margin, &fee);

        let id = Self::next_order_id(e);
        let order = Order {
            id,
            owner: trader.clone(),
            market_id,
            side,
            margin,
            notional,
            trigger_price,
            dir,
            reduce: false,
            reduce_position: 0,
            max_slippage_bps,
            created_at: e.ledger().timestamp(),
        };
        Self::store_order(e, &order);
        Self::add_user_order(e, &trader, id);
        Self::bump(e);
        OrderPlaced {
            trader,
            market_id,
            id,
            kind: Symbol::new(e, "limit"),
            trigger_price,
            notional,
        }
        .publish(e);
        id
    }

    /// Attach a **stop-loss / take-profit** to an existing position: the keeper
    /// closes it when the mark price crosses `trigger_price` in `dir`. No escrow —
    /// it settles the position's existing margin on fill.
    pub fn place_stop(
        e: &Env,
        trader: Address,
        position_id: u64,
        trigger_price: i128,
        dir: TriggerDir,
    ) -> u64 {
        let pos = Self::owned_position(e, &trader, position_id);
        if trigger_price <= 0 {
            panic_with_error!(e, EngineError::InvalidTrigger);
        }
        let id = Self::next_order_id(e);
        let order = Order {
            id,
            owner: trader.clone(),
            market_id: pos.market_id,
            side: pos.side,
            margin: 0,
            notional: pos.notional,
            trigger_price,
            dir,
            reduce: true,
            reduce_position: position_id,
            max_slippage_bps: 0,
            created_at: e.ledger().timestamp(),
        };
        Self::store_order(e, &order);
        Self::add_user_order(e, &trader, id);
        Self::bump(e);
        OrderPlaced {
            trader,
            market_id: pos.market_id,
            id,
            kind: Symbol::new(e, "stop"),
            trigger_price,
            notional: pos.notional,
        }
        .publish(e);
        id
    }

    /// Cancel a resting order. For entry orders the escrowed margin + fee are
    /// refunded to the owner (the LP nets to zero on the round-trip).
    pub fn cancel_order(e: &Env, trader: Address, order_id: u64) {
        let order = Self::order(e, order_id);
        trader.require_auth();
        if order.owner != trader {
            panic_with_error!(e, EngineError::NotOrderOwner);
        }
        if !order.reduce {
            let cfg = Self::market(e, order.market_id);
            let fee = apply_bps(order.notional, cfg.taker_fee_bps);
            Self::vault(e).settle(&trader, &order.margin, &(order.margin + fee));
        }
        Self::remove_order(e, &order);
        OrderCancelled {
            trader,
            id: order_id,
        }
        .publish(e);
    }

    /// Keeper: fill a resting order whose trigger has been crossed. Entry orders
    /// open a position from the escrowed margin; stop orders close the referenced
    /// position. Reverts `OrderNotTriggerable` if the price hasn't crossed yet.
    pub fn execute_order(e: &Env, keeper: Address, order_id: u64) {
        keeper.require_auth();
        if !Self::registry(e).is_keeper(&keeper) {
            panic_with_error!(e, EngineError::NotKeeper);
        }
        let order = Self::order(e, order_id);
        let cfg = Self::market(e, order.market_id);
        Self::ensure_active(e, &cfg);
        let price = Self::price(e, &cfg);
        if !Self::triggered(order.dir, price.price, order.trigger_price) {
            panic_with_error!(e, EngineError::OrderNotTriggerable);
        }

        if !order.reduce {
            // Entry: margin + fee were escrowed at placement.
            Self::check_slippage(e, price.price, order.trigger_price, order.max_slippage_bps);
            Self::validate_sizing(
                e,
                order.market_id,
                order.side,
                order.margin,
                order.notional,
                &cfg,
            );
            let fee = apply_bps(order.notional, cfg.taker_fee_bps);
            let position_id = Self::create_position(
                e,
                &order.owner,
                order.market_id,
                order.side,
                order.margin,
                order.notional,
                price.price,
                fee,
            );
            Self::remove_order(e, &order);
            OrderFilled {
                trader: order.owner,
                keeper,
                id: order_id,
                position_id,
                fill_price: price.price,
            }
            .publish(e);
        } else {
            // Stop: close the referenced position if it still exists + is owned.
            let pos = Self::position(e, order.reduce_position);
            if pos.owner != order.owner {
                panic_with_error!(e, EngineError::NotOrderOwner);
            }
            Self::close_internal(e, &pos);
            Self::remove_order(e, &order);
            OrderFilled {
                trader: order.owner,
                keeper,
                id: order_id,
                position_id: order.reduce_position,
                fill_price: price.price,
            }
            .publish(e);
        }
    }

    // ------------------------------------------------------------------ views

    pub fn get_position(e: &Env, id: u64) -> Position {
        Self::position(e, id)
    }

    pub fn get_order(e: &Env, id: u64) -> Order {
        Self::order(e, id)
    }

    pub fn user_order_ids(e: &Env, user: Address) -> Vec<u64> {
        e.storage()
            .persistent()
            .get(&DataKey::UserOrders(user))
            .unwrap_or(Vec::new(e))
    }

    /// All resting orders for a user (entry limits + stops).
    pub fn user_orders(e: &Env, user: Address) -> Vec<Order> {
        let ids = Self::user_order_ids(e, user);
        let mut out = Vec::new(e);
        for id in ids.iter() {
            if let Some(o) = e
                .storage()
                .persistent()
                .get::<_, Order>(&DataKey::Order(id))
            {
                out.push_back(o);
            }
        }
        out
    }

    pub fn user_position_ids(e: &Env, user: Address) -> Vec<u64> {
        e.storage()
            .persistent()
            .get(&DataKey::UserPositions(user))
            .unwrap_or(Vec::new(e))
    }

    /// All open positions for a user, each as a fully-computed [`PositionView`].
    pub fn user_positions(e: &Env, user: Address) -> Vec<PositionView> {
        let ids = Self::user_position_ids(e, user);
        let mut out = Vec::new(e);
        for id in ids.iter() {
            if let Some(p) = e
                .storage()
                .persistent()
                .get::<_, Position>(&DataKey::Position(id))
            {
                out.push_back(Self::view_of(e, &p));
            }
        }
        out
    }

    /// Computed snapshot of a single position (PnL, equity, liq price, …).
    pub fn position_view(e: &Env, id: u64) -> PositionView {
        let p = Self::position(e, id);
        Self::view_of(e, &p)
    }

    pub fn long_oi(e: &Env, market_id: u32) -> i128 {
        Self::oi(e, market_id, Side::Long)
    }
    pub fn short_oi(e: &Env, market_id: u32) -> i128 {
        Self::oi(e, market_id, Side::Short)
    }
    pub fn cumulative_funding(e: &Env, market_id: u32) -> i128 {
        Self::cum_funding(e, market_id)
    }
    pub fn last_funding_ts(e: &Env, market_id: u32) -> u64 {
        e.storage()
            .persistent()
            .get(&DataKey::LastFundingTs(market_id))
            .unwrap_or(0)
    }
    pub fn registry_address(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Registry).unwrap()
    }
    pub fn oracle_address(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Oracle).unwrap()
    }
    pub fn vault_address(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Vault).unwrap()
    }

    // -------------------------------------------------------------- internals

    fn view_of(e: &Env, p: &Position) -> PositionView {
        let cfg = Self::market(e, p.market_id);
        let mark = Self::price(e, &cfg).price;
        let pnl = position_pnl(p.notional, p.entry_price, mark, p.side);
        let funding = funding_payment(
            p.notional,
            Self::cum_funding(e, p.market_id),
            p.entry_funding,
            p.side,
        );
        let equity = p.margin + pnl - funding;
        let maintenance = apply_bps(p.notional, cfg.mmr_bps);
        // Solve equity == maintenance for price.
        let signed = maintenance - p.margin + funding; // usually negative
        let delta_px = p.entry_price * signed / p.notional;
        let liq = match p.side {
            Side::Long => p.entry_price + delta_px,
            Side::Short => p.entry_price - delta_px,
        };
        PositionView {
            id: p.id,
            owner: p.owner.clone(),
            market_id: p.market_id,
            side: p.side,
            margin: p.margin,
            notional: p.notional,
            entry_price: p.entry_price,
            mark_price: mark,
            unrealized_pnl: pnl,
            funding,
            equity,
            maintenance_margin: maintenance,
            liquidation_price: liq.max(0),
            leverage_bps: if p.margin > 0 {
                p.notional * BPS_DENOM / p.margin
            } else {
                0
            },
            margin_ratio_bps: if p.notional > 0 {
                equity * BPS_DENOM / p.notional
            } else {
                0
            },
        }
    }

    fn ensure_active(e: &Env, cfg: &MarketConfig) {
        if Self::registry(e).is_paused() {
            panic_with_error!(e, EngineError::GlobalPaused);
        }
        if cfg.paused {
            panic_with_error!(e, EngineError::MarketPaused);
        }
    }

    fn check_slippage(e: &Env, mark: i128, ref_price: i128, max_slippage_bps: u32) {
        if ref_price <= 0 {
            return;
        }
        let diff = (mark - ref_price).abs();
        if diff * BPS_DENOM / ref_price > max_slippage_bps as i128 {
            panic_with_error!(e, EngineError::SlippageExceeded);
        }
    }

    fn registry(e: &Env) -> RegistryClient<'static> {
        RegistryClient::new(e, &Self::registry_address(e))
    }
    fn oracle(e: &Env) -> OracleClient<'static> {
        OracleClient::new(e, &Self::oracle_address(e))
    }
    fn vault(e: &Env) -> VaultClient<'static> {
        VaultClient::new(e, &Self::vault_address(e))
    }

    fn market(e: &Env, id: u32) -> MarketConfig {
        Self::registry(e).get_market(&id)
    }
    fn price(e: &Env, cfg: &MarketConfig) -> OraclePrice {
        Self::oracle(e).get_price(&cfg.feed)
    }

    fn next_id(e: &Env) -> u64 {
        let id: u64 = e.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        e.storage().instance().set(&DataKey::NextId, &(id + 1));
        id
    }

    fn position(e: &Env, id: u64) -> Position {
        e.storage()
            .persistent()
            .get(&DataKey::Position(id))
            .unwrap_or_else(|| panic_with_error!(e, EngineError::PositionNotFound))
    }

    fn owned_position(e: &Env, trader: &Address, id: u64) -> Position {
        let pos = Self::position(e, id);
        trader.require_auth();
        if &pos.owner != trader {
            panic_with_error!(e, EngineError::NotOwner);
        }
        pos
    }

    fn store_position(e: &Env, pos: &Position) {
        let key = DataKey::Position(pos.id);
        e.storage().persistent().set(&key, pos);
        e.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
    }

    fn remove_position(e: &Env, pos: &Position) {
        e.storage().persistent().remove(&DataKey::Position(pos.id));
        let key = DataKey::UserPositions(pos.owner.clone());
        let ids: Vec<u64> = e.storage().persistent().get(&key).unwrap_or(Vec::new(e));
        let mut next = Vec::new(e);
        for id in ids.iter() {
            if id != pos.id {
                next.push_back(id);
            }
        }
        e.storage().persistent().set(&key, &next);
    }

    fn add_user_position(e: &Env, user: &Address, id: u64) {
        let key = DataKey::UserPositions(user.clone());
        let mut ids: Vec<u64> = e.storage().persistent().get(&key).unwrap_or(Vec::new(e));
        ids.push_back(id);
        e.storage().persistent().set(&key, &ids);
        e.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
    }

    // ---- conditional-order storage ----

    /// True when `price` has crossed `trigger` in the order's direction.
    fn triggered(dir: TriggerDir, price: i128, trigger: i128) -> bool {
        match dir {
            TriggerDir::Above => price >= trigger,
            TriggerDir::Below => price <= trigger,
        }
    }

    fn order(e: &Env, id: u64) -> Order {
        e.storage()
            .persistent()
            .get(&DataKey::Order(id))
            .unwrap_or_else(|| panic_with_error!(e, EngineError::OrderNotFound))
    }

    fn next_order_id(e: &Env) -> u64 {
        let id: u64 = e
            .storage()
            .instance()
            .get(&DataKey::NextOrderId)
            .unwrap_or(0);
        e.storage().instance().set(&DataKey::NextOrderId, &(id + 1));
        id
    }

    fn store_order(e: &Env, order: &Order) {
        let key = DataKey::Order(order.id);
        e.storage().persistent().set(&key, order);
        e.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
    }

    fn add_user_order(e: &Env, user: &Address, id: u64) {
        let key = DataKey::UserOrders(user.clone());
        let mut ids: Vec<u64> = e.storage().persistent().get(&key).unwrap_or(Vec::new(e));
        ids.push_back(id);
        e.storage().persistent().set(&key, &ids);
        e.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
    }

    fn remove_order(e: &Env, order: &Order) {
        e.storage().persistent().remove(&DataKey::Order(order.id));
        let key = DataKey::UserOrders(order.owner.clone());
        let ids: Vec<u64> = e.storage().persistent().get(&key).unwrap_or(Vec::new(e));
        let mut next = Vec::new(e);
        for id in ids.iter() {
            if id != order.id {
                next.push_back(id);
            }
        }
        e.storage().persistent().set(&key, &next);
    }

    fn cum_funding(e: &Env, market_id: u32) -> i128 {
        e.storage()
            .persistent()
            .get(&DataKey::CumFunding(market_id))
            .unwrap_or(0)
    }

    fn oi(e: &Env, market_id: u32, side: Side) -> i128 {
        let key = match side {
            Side::Long => DataKey::LongOi(market_id),
            Side::Short => DataKey::ShortOi(market_id),
        };
        e.storage().persistent().get(&key).unwrap_or(0)
    }

    fn set_oi(e: &Env, market_id: u32, side: Side, value: i128) {
        let key = match side {
            Side::Long => DataKey::LongOi(market_id),
            Side::Short => DataKey::ShortOi(market_id),
        };
        e.storage().persistent().set(&key, &value);
        e.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
    }

    fn bump(e: &Env) {
        e.storage()
            .instance()
            .extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
    }
}

#[cfg(test)]
mod test;
