#![cfg(test)]
use crate::{EngineError, PerpEngine, PerpEngineClient};
use collateral_vault::{CollateralVault, CollateralVaultClient};
use helix_shared::{MarketConfig, ReflectorAsset, Side};
use market_registry::{MarketRegistry, MarketRegistryClient};
use mock_oracle::{MockOracle, MockOracleClient};
use mock_usdc::{MockUsdc, MockUsdcClient};
use oracle_adapter::{OracleAdapter, OracleAdapterClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol};

const ONE: i128 = 10_000_000; // 1 USDC / $1.00 at 7 dp
const E14: i128 = 100_000_000_000_000; // Reflector 14-dp scale
const MARKET: u32 = 1;

struct World<'a> {
    e: Env,
    engine: PerpEngineClient<'a>,
    vault: CollateralVaultClient<'a>,
    registry: MarketRegistryClient<'a>,
    oracle_mock: MockOracleClient<'a>,
    usdc: MockUsdcClient<'a>,
    admin: Address,
    keeper: Address,
}

fn xau_cfg(e: &Env) -> MarketConfig {
    MarketConfig {
        id: MARKET,
        symbol: Symbol::new(e, "XAUPERP"),
        feed: Symbol::new(e, "XAU"),
        max_leverage: 20,
        imr_bps: 500,
        mmr_bps: 250,
        taker_fee_bps: 10,        // 0.10%
        liquidation_fee_bps: 100, // 1%
        max_oi: 1_000_000 * ONE,
        min_position_size: 10 * ONE,
        max_funding_rate_bps: 100, // 1% per period
        paused: false,
    }
}

fn world() -> World<'static> {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let keeper = Address::generate(&e);

    let token = e.register(
        MockUsdc,
        (
            String::from_str(&e, "Helix USD"),
            String::from_str(&e, "USDC"),
            admin.clone(),
            0i128,
        ),
    );
    let mock = e.register(MockOracle, (admin.clone(), 14u32));
    // Wide guard bounds here — oracle safety is exercised in oracle_adapter tests.
    let oracle = e.register(
        OracleAdapter,
        (admin.clone(), mock.clone(), 1_000_000u64, 50_000u32),
    );
    let registry = e.register(MarketRegistry, (admin.clone(), keeper.clone()));
    let vault = e.register(CollateralVault, (admin.clone(), token.clone()));
    let engine = e.register(
        PerpEngine,
        (registry.clone(), oracle.clone(), vault.clone()),
    );

    let w = World {
        engine: PerpEngineClient::new(&e, &engine),
        vault: CollateralVaultClient::new(&e, &vault),
        registry: MarketRegistryClient::new(&e, &registry),
        oracle_mock: MockOracleClient::new(&e, &mock),
        usdc: MockUsdcClient::new(&e, &token),
        admin,
        keeper,
        e: e.clone(),
    };

    w.vault.set_engine(&engine);
    OracleAdapterClient::new(&e, &oracle).set_feed(
        &Symbol::new(&e, "XAU"),
        &ReflectorAsset::Other(Symbol::new(&e, "XAU")),
    );
    w.set_price(2_400);
    w.registry.add_market(&xau_cfg(&e));

    // Seed deep LP liquidity so the vault can always pay profits.
    let lp = Address::generate(&e);
    w.usdc.faucet(&lp, &(1_000_000 * ONE));
    w.vault.add_liquidity(&lp, &(1_000_000 * ONE));
    w
}

impl<'a> World<'a> {
    fn set_price(&self, usd: i128) {
        self.oracle_mock.set_price(
            &ReflectorAsset::Other(Symbol::new(&self.e, "XAU")),
            &(usd * E14),
        );
    }
    fn funded_trader(&self, amount: i128) -> Address {
        let t = Address::generate(&self.e);
        self.usdc.faucet(&t, &amount);
        t
    }
    fn open_long(&self, trader: &Address, margin: i128, notional: i128) -> u64 {
        self.engine
            .open_position(trader, &MARKET, &Side::Long, &margin, &notional, &0, &0)
    }
}

#[test]
fn open_long_records_position_and_oi() {
    let w = world();
    let trader = w.funded_trader(200 * ONE);
    let id = w.open_long(&trader, 100 * ONE, 1_000 * ONE); // 10x

    let p = w.engine.get_position(&id);
    assert_eq!(p.owner, trader);
    assert_eq!(p.notional, 1_000 * ONE);
    assert_eq!(p.entry_price, 2_400 * ONE);
    assert_eq!(w.engine.long_oi(&MARKET), 1_000 * ONE);

    let v = w.engine.position_view(&id);
    assert_eq!(v.unrealized_pnl, 0);
    assert_eq!(v.leverage_bps, 10 * 10_000); // 10x
                                             // margin (100) + fee (1) pulled from the trader.
    assert_eq!(w.usdc.balance(&trader), 99 * ONE);
}

#[test]
fn open_profit_close_round_trip() {
    let w = world();
    let trader = w.funded_trader(101 * ONE);
    let id = w.open_long(&trader, 100 * ONE, 1_000 * ONE);
    assert_eq!(w.usdc.balance(&trader), 0);

    w.set_price(2_640); // +10% => +$100 on $1000 notional
    let v = w.engine.position_view(&id);
    assert_eq!(v.unrealized_pnl, 100 * ONE);

    w.engine.close_position(&trader, &id);
    // payout = margin 100 + pnl 100 - close fee 1 = 199
    assert_eq!(w.usdc.balance(&trader), 199 * ONE);
    assert_eq!(w.engine.long_oi(&MARKET), 0);
    assert!(w.engine.try_get_position(&id).is_err());
}

#[test]
fn loss_is_paid_to_the_vault() {
    let w = world();
    let lp_before = w.vault.lp_cash();
    let trader = w.funded_trader(101 * ONE);
    let id = w.open_long(&trader, 100 * ONE, 1_000 * ONE);

    w.set_price(2_280); // -5% => -$50
    w.engine.close_position(&trader, &id);
    // trader gets 100 - 50 - 1(fee) = 49 back
    assert_eq!(w.usdc.balance(&trader), 49 * ONE);
    // LP gained the $50 loss + $1 open fee + $1 close fee = $52
    assert_eq!(w.vault.lp_cash(), lp_before + 52 * ONE);
}

#[test]
fn funding_accrues_and_longs_pay() {
    let w = world();
    let trader = w.funded_trader(101 * ONE);
    let id = w.open_long(&trader, 100 * ONE, 1_000 * ONE);

    // Only longs are open => max positive funding (+1%).
    let rate = w.engine.update_funding(&w.keeper, &MARKET);
    assert_eq!(rate, 100); // bps
    assert_eq!(
        w.engine.cumulative_funding(&MARKET),
        100 * (FUNDING_PER_BPS())
    );

    // Close at flat price: pay $10 funding (1% of $1000) + $1 close fee.
    w.engine.close_position(&trader, &id);
    assert_eq!(w.usdc.balance(&trader), 89 * ONE); // 100 - 10 - 1
}

#[allow(non_snake_case)]
fn FUNDING_PER_BPS() -> i128 {
    // 1e18 / 1e4
    100_000_000_000_000
}

#[test]
