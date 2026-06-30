#![cfg(test)]
use crate::{MockOracle, MockOracleClient};
use helix_shared::ReflectorAsset;
use soroban_sdk::{testutils::Address as _, Address, Env, Symbol};

fn setup(e: &Env) -> MockOracleClient<'static> {
    let admin = Address::generate(e);
    let id = e.register(MockOracle, (admin, 14u32));
    MockOracleClient::new(e, &id)
}

#[test]
fn set_and_read_price() {
    let e = Env::default();
    e.mock_all_auths();
    let oracle = setup(&e);
    let xau = ReflectorAsset::Other(Symbol::new(&e, "XAU"));

    assert_eq!(oracle.decimals(), 14);
    assert!(oracle.lastprice(&xau).is_none());

    oracle.set_price(&xau, &(2_400i128 * 100_000_000_000_000)); // $2400 @ 14dp
    let pd = oracle.lastprice(&xau).unwrap();
    assert_eq!(pd.price, 2_400i128 * 100_000_000_000_000);
}

#[test]
fn explicit_timestamp_for_stale_simulation() {
    let e = Env::default();
    e.mock_all_auths();
    let oracle = setup(&e);
    let eur = ReflectorAsset::Other(Symbol::new(&e, "EUR"));
    oracle.set_price_at(&eur, &(108i128 * 1_000_000_000_000), &1000u64);
    assert_eq!(oracle.lastprice(&eur).unwrap().timestamp, 1000);
}
