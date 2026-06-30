<#
  Helix - refresh demo oracle prices + widen the staleness window.

  The mock oracle has no upstream price stream, so without the keeper running its
  prices eventually exceed oracle_adapter's max_age and get_price() rejects them
  (StalePrice). For a self-running demo we (a) widen max_age generously and
  (b) re-stamp the prices to "now". The keeper does this continuously in prod.

  Usage: pwsh scripts/refresh_oracle.ps1 [-Key helix]
#>
param([string]$Key = "helix", [string]$Network = "testnet")
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "helix-refresh"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

$d = Get-Content "$root/deploy/testnet.json" -Raw | ConvertFrom-Json
$ADAPTER = $d.contracts.oracle_adapter
$ORACLE = $d.contracts.mock_oracle
$ENGINE = $d.contracts.perp_engine
$KEEPER = $d.keeper

function St { param([Parameter(ValueFromRemainingArguments = $true)][string[]]$a)
  $out = & stellar @a
  if ($LASTEXITCODE -ne 0) { throw "stellar $($a -join ' ') failed" }
  return ($out | Out-String).Trim()
}

# 30-day staleness window, 50% deviation band (demo-friendly).
Write-Host "Widening oracle guards (max_age=30d) ..." -ForegroundColor Cyan
St contract invoke --id $ADAPTER --source $Key --network $Network '--' set_guards --max_age 2592000 --max_deviation_bps 5000 | Out-Null

$feeds = @(
  @{ feed = "XAU"; price = "240000000000000000" }
  @{ feed = "EUR"; price = "108000000000000" }
  @{ feed = "XLM"; price = "12000000000000" }
)
foreach ($f in $feeds) {
  Write-Host "Re-stamping $($f.feed) ..." -ForegroundColor Cyan
  $asset = Join-Path $tmp "asset_$($f.feed).json"
  [System.IO.File]::WriteAllText($asset, '{"Other":"' + $f.feed + '"}')
  St contract invoke --id $ORACLE --source $Key --network $Network '--' set_price --asset-file-path $asset --price $f.price | Out-Null
}

# Re-commit the adapter's last-accepted price + funding via the engine.
foreach ($id in 1, 2, 3) {
  St contract invoke --id $ENGINE --source $Key --network $Network '--' update_funding --keeper $KEEPER --market_id $id | Out-Null
}
Write-Host "Oracle refreshed. get_price() will now succeed." -ForegroundColor Green
