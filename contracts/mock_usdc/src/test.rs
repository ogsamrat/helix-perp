#![cfg(test)]
use crate::{MockUsdc, MockUsdcClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

const ONE: i128 = 10_000_000; // 1 USDC at 7 dp

fn setup(e: &Env) -> (MockUsdcClient<'static>, Address) {
    let admin = Address::generate(e);
    let id = e.register(
        MockUsdc,
        (
            String::from_str(e, "Helix Mock USD"),
            String::from_str(e, "USDC"),
            admin.clone(),
            1_000 * ONE,
        ),
    );
    (MockUsdcClient::new(e, &id), admin)
}

#[test]
fn metadata_and_initial_supply() {
    let e = Env::default();
    e.mock_all_auths();
    let (usdc, admin) = setup(&e);
    assert_eq!(usdc.decimals(), 7);
    assert_eq!(usdc.symbol(), String::from_str(&e, "USDC"));
    assert_eq!(usdc.balance(&admin), 1_000 * ONE);
