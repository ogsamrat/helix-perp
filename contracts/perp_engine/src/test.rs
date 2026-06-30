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

