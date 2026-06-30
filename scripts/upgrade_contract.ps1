<#
  Helix - demonstrate the contract upgrade path.

  Rebuilds a contract, uploads the new WASM, and calls `upgrade(new_wasm_hash)`
  on the deployed instance (admin-gated). Defaults to market_registry, which
  exposes `upgrade(BytesN<32>)` behind the OZ #[only_admin] gate.

  Usage: pwsh scripts/upgrade_contract.ps1 [-Package market_registry] [-Key helix]
#>
param(
  [string]$Package = "market_registry",
  [string]$Key = "helix",
  [string]$Network = "testnet"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"

$deploy = Get-Content "$root/deploy/testnet.json" -Raw | ConvertFrom-Json
$idMap = @{
  market_registry  = $deploy.contracts.market_registry
  collateral_vault = $deploy.contracts.collateral_vault
  oracle_adapter   = $deploy.contracts.oracle_adapter
  perp_engine      = $deploy.contracts.perp_engine
}
$contractId = $idMap[$Package]
if (-not $contractId) { throw "Unknown / non-upgradeable package: $Package" }

Write-Host "Rebuilding $Package ..." -ForegroundColor Cyan
stellar contract build --package $Package | Out-Null

$wasm = "target/wasm32v1-none/release/$Package.wasm"
Write-Host "Uploading new WASM ..." -ForegroundColor Cyan
$hash = (stellar contract upload --wasm $wasm --source $Key --network $Network | Out-String).Trim()
Write-Host "  new wasm hash: $hash" -ForegroundColor Green

Write-Host "Calling upgrade() on $contractId ..." -ForegroundColor Cyan
stellar contract invoke --id $contractId --source $Key --network $Network '--' upgrade --new_wasm_hash $hash | Out-Null

Write-Host "Upgrade complete. $Package now runs WASM $hash" -ForegroundColor Green
