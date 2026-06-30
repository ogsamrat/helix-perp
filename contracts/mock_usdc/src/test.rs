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
    assert_eq!(usdc.total_supply(), 1_000 * ONE);
}

#[test]
fn faucet_mints_and_transfers() {
    let e = Env::default();
    e.mock_all_auths();
    let (usdc, _admin) = setup(&e);
    let user = Address::generate(&e);
    let other = Address::generate(&e);

    usdc.faucet(&user, &(500 * ONE));
    assert_eq!(usdc.balance(&user), 500 * ONE);

    usdc.transfer(&user, &other, &(200 * ONE));
    assert_eq!(usdc.balance(&user), 300 * ONE);
    assert_eq!(usdc.balance(&other), 200 * ONE);
}

#[test]
fn faucet_rejects_invalid_amount() {
    let e = Env::default();
    e.mock_all_auths();
    let (usdc, _admin) = setup(&e);
    let user = Address::generate(&e);
    // zero and over-cap both rejected
    assert!(usdc.try_faucet(&user, &0).is_err());
    assert!(usdc.try_faucet(&user, &(2_000_000 * ONE)).is_err());
}
