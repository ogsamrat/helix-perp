#![cfg(test)]
use crate::{MarketRegistry, MarketRegistryClient};
use helix_shared::MarketConfig;
use soroban_sdk::{testutils::Address as _, Address, Env, Symbol};

const ONE: i128 = 10_000_000;

fn xau_cfg(e: &Env, id: u32) -> MarketConfig {
    MarketConfig {
        id,
        symbol: Symbol::new(e, "XAUPERP"),
        feed: Symbol::new(e, "XAU"),
        max_leverage: 20,
        imr_bps: 500, // 5% -> 20x
        mmr_bps: 250, // 2.5%
        taker_fee_bps: 10,
        liquidation_fee_bps: 100,
        max_oi: 1_000_000 * ONE,
        min_position_size: 10 * ONE,
        max_funding_rate_bps: 100,
        paused: false,
    }
}

fn setup(e: &Env) -> (MarketRegistryClient<'static>, Address, Address) {
    let admin = Address::generate(e);
    let keeper = Address::generate(e);
    let id = e.register(MarketRegistry, (admin.clone(), keeper.clone()));
    (MarketRegistryClient::new(e, &id), admin, keeper)
}

#[test]
fn add_and_read_market() {
    let e = Env::default();
    e.mock_all_auths();
    let (reg, _admin, _keeper) = setup(&e);
    reg.add_market(&xau_cfg(&e, 1));

    assert!(reg.has_market(&1));
    assert_eq!(reg.get_market(&1).symbol, Symbol::new(&e, "XAUPERP"));
    assert_eq!(reg.market_ids().len(), 1);
    assert_eq!(reg.get_all_markets().len(), 1);
    assert!(!reg.is_paused());
}

#[test]
fn roles_seeded_at_construction() {
    let e = Env::default();
    e.mock_all_auths();
    let (reg, admin, keeper) = setup(&e);
    assert!(reg.is_keeper(&keeper));
    assert!(reg.is_keeper(&admin));
    assert!(!reg.is_keeper(&Address::generate(&e)));
}

#[test]
fn rejects_invalid_config() {
    let e = Env::default();
    e.mock_all_auths();
    let (reg, _admin, _keeper) = setup(&e);
    let mut bad = xau_cfg(&e, 2);
    bad.mmr_bps = 600; // mmr >= imr -> invalid
    assert!(reg.try_add_market(&bad).is_err());
}

#[test]
fn global_pause_toggles() {
    let e = Env::default();
    e.mock_all_auths();
    let (reg, admin, _keeper) = setup(&e);
    reg.pause(&admin); // admin holds pauser role
    assert!(reg.is_paused());
    reg.unpause(&admin);
    assert!(!reg.is_paused());
}

#[test]
fn rbac_denies_non_pauser() {
    let e = Env::default();
    e.mock_all_auths(); // auth is satisfied; the *role* check is what must reject
    let (reg, _admin, _keeper) = setup(&e);
    reg.add_market(&xau_cfg(&e, 1));
    let intruder = Address::generate(&e);
    // intruder has no `pauser` role -> ensure_role panics even with mocked auth.
    assert!(reg.try_set_market_paused(&intruder, &1, &true).is_err());
}
