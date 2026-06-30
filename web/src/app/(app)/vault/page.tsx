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
