#![cfg(test)]
use crate::{OracleAdapter, OracleAdapterClient, OracleError};
use helix_shared::ReflectorAsset;
use mock_oracle::{MockOracle, MockOracleClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Env, Symbol,
};

const E14: i128 = 100_000_000_000_000; // 1e14 (Reflector native scale)
const E7: i128 = 10_000_000; // 1e7 (normalised scale)

struct Fix<'a> {
    adapter: OracleAdapterClient<'a>,
    oracle: MockOracleClient<'a>,
}

fn setup(e: &Env, max_age: u64, max_dev_bps: u32) -> Fix<'static> {
    let admin = Address::generate(e);
    let oracle_id = e.register(MockOracle, (admin.clone(), 14u32));
    let adapter_id = e.register(
        OracleAdapter,
        (admin.clone(), oracle_id.clone(), max_age, max_dev_bps),
    );
    Fix {
        adapter: OracleAdapterClient::new(e, &adapter_id),
        oracle: MockOracleClient::new(e, &oracle_id),
    }
}

#[test]
fn normalizes_reflector_14dp_to_7dp() {
    let e = Env::default();
    e.mock_all_auths();
    let f = setup(&e, 300, 1000);
    let feed = Symbol::new(&e, "XAU");
    f.adapter
        .set_feed(&feed, &ReflectorAsset::Other(Symbol::new(&e, "XAU")));
    f.oracle.set_price(
        &ReflectorAsset::Other(Symbol::new(&e, "XAU")),
        &(2_400 * E14),
    );

    let p = f.adapter.get_price(&feed);
    assert_eq!(p.price, 2_400 * E7); // $2,400.0000000
    assert_eq!(f.adapter.last_price(&feed).unwrap().price, 2_400 * E7);
    assert_eq!(f.adapter.oracle_decimals(), 14);
}

#[test]
fn rejects_stale_price() {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().with_mut(|l| l.timestamp = 10_000);
    let f = setup(&e, 300, 5000);
    let feed = Symbol::new(&e, "EUR");
    f.adapter
