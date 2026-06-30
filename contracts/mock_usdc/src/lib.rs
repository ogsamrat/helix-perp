#![no_std]
//! Mock USDC — a SEP-41 fungible token (7 decimals) built on the OpenZeppelin
//! `stellar-tokens` standard, with a permissionless `faucet` so demo wallets and
//! judges can self-fund with zero setup.
//!
//! On mainnet the protocol points its `collateral_vault` at the real USDC Stellar
//! Asset Contract (SAC) instead — collateral is a config address, so swapping is a
//! one-line change with no code edits here.

use soroban_sdk::{
    contract, contracterror, contractimpl, panic_with_error, Address, Env, MuxedAddress, String,
};
use stellar_tokens::fungible::{burnable::FungibleBurnable, Base, FungibleToken};

/// 7 decimals, matching mainnet USDC and the protocol's `USDC_SCALE`.
const DECIMALS: u32 = 7;
/// Faucet ceiling per call: 1,000,000 USDC (1e6 * 1e7). Generous for demos,
/// bounded so nobody can mint absurd balances that complicate accounting.
const FAUCET_MAX: i128 = 1_000_000 * 10_000_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MockUsdcError {
    /// Requested faucet amount is non-positive or exceeds `FAUCET_MAX`.
    InvalidFaucetAmount = 1,
}

#[contract]
pub struct MockUsdc;

#[contractimpl]
impl MockUsdc {
    /// Initialise token metadata. `initial_supply` (if > 0) is minted to `admin`
    /// so a deploy script can pre-seed LP liquidity.
    pub fn __constructor(
        e: &Env,
        name: String,
        symbol: String,
        admin: Address,
        initial_supply: i128,
    ) {
        Base::set_metadata(e, DECIMALS, name, symbol);
        if initial_supply > 0 {
            Base::mint(e, &admin, initial_supply);
        }
    }

    /// Permissionless demo faucet — mint test USDC to any address. Capped per call.
    pub fn faucet(e: &Env, to: Address, amount: i128) {
        if amount <= 0 || amount > FAUCET_MAX {
            panic_with_error!(e, MockUsdcError::InvalidFaucetAmount);
        }
        Base::mint(e, &to, amount);
    }
