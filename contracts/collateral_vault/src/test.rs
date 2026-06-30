#![cfg(test)]
use crate::{CollateralVault, CollateralVaultClient, VaultError};
use mock_usdc::{MockUsdc, MockUsdcClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

const ONE: i128 = 10_000_000;

struct Fix<'a> {
    vault: CollateralVaultClient<'a>,
    usdc: MockUsdcClient<'a>,
    engine: Address,
}

fn setup(e: &Env) -> Fix<'static> {
    let admin = Address::generate(e);
    let engine = Address::generate(e);
    let token = e.register(
        MockUsdc,
        (
            String::from_str(e, "USD"),
            String::from_str(e, "USDC"),
            admin.clone(),
            0i128,
        ),
    );
    let vault_id = e.register(CollateralVault, (admin.clone(), token.clone()));
    let vault = CollateralVaultClient::new(e, &vault_id);
    vault.set_engine(&engine);
    Fix {
        vault,
        usdc: MockUsdcClient::new(e, &token),
        engine,
    }
}

fn lp_with(e: &Env, f: &Fix, amount: i128) -> Address {
    let lp = Address::generate(e);
    f.usdc.faucet(&lp, &amount);
    f.vault.add_liquidity(&lp, &amount);
    lp
}

fn trader_with(e: &Env, f: &Fix, amount: i128) -> Address {
    let t = Address::generate(e);
    f.usdc.faucet(&t, &amount);
    t
}

#[test]
fn first_deposit_mints_one_to_one() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let f = setup(&e);
    let lp = lp_with(&e, &f, 1_000 * ONE);
    assert_eq!(f.vault.lp_cash(), 1_000 * ONE);
    assert_eq!(f.vault.total_shares(), 1_000 * ONE);
    assert_eq!(f.vault.shares_of(&lp), 1_000 * ONE);
    assert_eq!(f.vault.share_price(), ONE); // $1.00
}

#[test]
fn trader_loss_accrues_to_lp() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let f = setup(&e);
    let lp = lp_with(&e, &f, 1_000 * ONE);
    let trader = trader_with(&e, &f, 101 * ONE);

    f.vault.lock_margin(&trader, &(100 * ONE), &(1 * ONE)); // margin 100, fee 1
    assert_eq!(f.vault.margin_pool(), 100 * ONE);
    assert_eq!(f.vault.lp_cash(), 1_001 * ONE); // fee to LPs

    // Close at a $50 loss: trader gets 50 back, LP keeps the other 50.
    f.vault.settle(&trader, &(100 * ONE), &(50 * ONE));
    assert_eq!(f.vault.margin_pool(), 0);
    assert_eq!(f.vault.lp_cash(), 1_051 * ONE);
    assert_eq!(f.usdc.balance(&trader), 50 * ONE);

    // Share price rose: 1051 / 1000 = $1.051.
    assert_eq!(f.vault.share_price(), 1_051 * ONE / 1_000);
    let out = f.vault.remove_liquidity(&lp, &(1_000 * ONE));
    assert_eq!(out, 1_051 * ONE);
}

#[test]
fn trader_profit_paid_by_lp() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let f = setup(&e);
    let _lp = lp_with(&e, &f, 1_000 * ONE);
    let trader = trader_with(&e, &f, 100 * ONE);

    f.vault.lock_margin(&trader, &(100 * ONE), &0);
    f.vault.settle(&trader, &(100 * ONE), &(150 * ONE)); // $50 profit
    assert_eq!(f.vault.lp_cash(), 950 * ONE);
    assert_eq!(f.usdc.balance(&trader), 150 * ONE);
}

#[test]
fn refuses_payout_beyond_liquidity() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let f = setup(&e);
    let _lp = lp_with(&e, &f, 100 * ONE);
    let trader = trader_with(&e, &f, 100 * ONE);
    f.vault.lock_margin(&trader, &(100 * ONE), &0);
    // payout 201 => LP must fund 101 but only has 100 => refuse.
    let res = f.vault.try_settle(&trader, &(100 * ONE), &(201 * ONE));
    assert_eq!(res, Err(Ok(VaultError::InsufficientLiquidity.into())));
}

#[test]
fn cannot_set_engine_twice() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let f = setup(&e);
    assert_eq!(f.vault.engine(), Some(f.engine.clone()));
    assert!(f.vault.try_set_engine(&Address::generate(&e)).is_err());
}
