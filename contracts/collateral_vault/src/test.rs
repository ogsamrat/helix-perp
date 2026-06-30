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
