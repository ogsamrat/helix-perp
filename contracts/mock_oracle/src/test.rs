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
