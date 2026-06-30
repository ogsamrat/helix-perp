"use client";
import { Layers } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { AmountField } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { StatRow, StatTile } from "@/components/ui/stat";
import { useChainAction, useUsdcBalance, useVaultShares, useVaultStats } from "@/hooks/use-chain";
import { fmtCompactUsd, fmtPct, fmtUsd, SCALE_NUM, toScaled, toUnits } from "@/lib/format";
import { calls } from "@/lib/stellar/contracts";
import { useWallet } from "@/lib/wallet/store";

export default function VaultPage() {
  const { address, connect } = useWallet();
  const stats = useVaultStats();
  const shares = useVaultShares();
  const balance = useUsdcBalance();
  const action = useChainAction();

  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [amt, setAmt] = useState("");

  const sharePriceUnits = stats.data ? toUnits(stats.data.sharePrice) : 1;
  const myShares = shares.data ?? 0n;
  const myValueScaled = stats.data ? (myShares * stats.data.sharePrice) / BigInt(SCALE_NUM) : 0n;
  const tvl = stats.data?.lpCash ?? 0n;
  const utilization = stats.data ? Number(stats.data.utilizationBps) / 100 : 0;
  const realizedReturn = sharePriceUnits - 1; // since inception (share price starts at 1.0)

  const amount = parseFloat(amt) || 0;
  const balUnits = toUnits(balance.data ?? 0n);
  const myValueUnits = toUnits(myValueScaled);

  const submit = async () => {
    if (!address || amount <= 0) return;
    let call;
    if (mode === "deposit") {
      call = calls.addLiquidity(address, toScaled(amount));
    } else {
      const shareAmt = stats.data && stats.data.sharePrice > 0n
        ? (toScaled(amount) * BigInt(SCALE_NUM)) / stats.data.sharePrice
        : 0n;
      const capped = shareAmt > myShares ? myShares : shareAmt;
      call = calls.removeLiquidity(address, capped);
    }
    const res = await action.mutateAsync({ call });
    if (res) setAmt("");
  };

  const max = mode === "deposit" ? balUnits : myValueUnits;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">Liquidity Vault</h1>
        <p className="text-sm text-ink-muted">
          Provide USDC liquidity that backs every position. Earn taker fees + funding; bear trader PnL.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Vault TVL" value={fmtCompactUsd(tvl)} sub="LP liquidity" />
        <StatTile label="Utilization" value={fmtPct(utilization / 100)} sub="margin / assets" />
        <StatTile label="Share price" value={"$" + sharePriceUnits.toFixed(6)} sub="USDC per share" />
        <StatTile
          label="Realized LP return"
          value={<span className={realizedReturn >= 0 ? "text-long" : "text-short"}>{fmtPct(realizedReturn)}</span>}
          sub="since inception"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Vault overview</CardTitle>
            <Layers className="h-4 w-4 text-ink-faint" />
          </CardHeader>
          <CardBody className="space-y-1">
            <StatRow label="Total liquidity (LP cash)" value={fmtUsd(stats.data?.lpCash ?? 0n)} />
            <StatRow label="Locked margin" value={fmtUsd(stats.data?.marginPool ?? 0n)} />
            <StatRow label="Total assets" value={fmtUsd(stats.data?.totalAssets ?? 0n)} />
            <StatRow label="Total shares" value={(toUnits(stats.data?.totalShares ?? 0n)).toLocaleString()} />
            <div className="my-2 h-px bg-hairline" />
            <StatRow label="Your shares" value={toUnits(myShares).toLocaleString()} />
            <StatRow label="Your position value" value={<span className="text-brand">{fmtUsd(myValueScaled)}</span>} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provide liquidity</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Segmented
              options={[
                { label: "Deposit", value: "deposit" },
                { label: "Withdraw", value: "withdraw" },
              ]}
              value={mode}
              onChange={(v) => setMode(v as "deposit" | "withdraw")}
              className="w-full [&>button]:flex-1"
            />
            <AmountField
              label={mode === "deposit" ? "Deposit USDC" : "Withdraw USDC"}
              value={amt}
              onChange={setAmt}
              onMax={address ? () => setAmt((Math.floor(max * 100) / 100).toString()) : undefined}
              hint={<span className="text-ink-faint">Max {fmtUsd(toScaled(max))}</span>}
            />
            <div className="rounded-lg border border-hairline bg-canvas p-3">
              <StatRow label="Share price" value={"$" + sharePriceUnits.toFixed(6)} />
              <StatRow
                label={mode === "deposit" ? "Shares received" : "Shares burned"}
                value={(sharePriceUnits > 0 ? amount / sharePriceUnits : 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              />
            </div>
            {address ? (
              <Button
                variant="primary"
                className="w-full"
                loading={action.isPending}
                disabled={amount <= 0 || amount > max + 1e-6}
                onClick={submit}
              >
                {amount > max + 1e-6 ? "Amount exceeds max" : mode === "deposit" ? "Deposit" : "Withdraw"}
              </Button>
            ) : (
              <Button variant="primary" className="w-full" onClick={() => connect()}>
                Connect wallet
              </Button>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
