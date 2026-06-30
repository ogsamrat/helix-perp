"use client";
import { useMemo, useState } from "react";
import { GetFundsButton } from "@/components/shell/get-funds";
import { Button } from "@/components/ui/button";
import { AmountField, LeverageSlider } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { StatRow } from "@/components/ui/stat";
import type { MarketMeta } from "@/config";
import { useChainAction, useUsdcBalance } from "@/hooks/use-chain";
import { fmtBps, fmtPrice, fmtUsd, toScaled, toUnits } from "@/lib/format";
import { calls } from "@/lib/stellar/contracts";
import type { MarketConfig, Side } from "@/lib/stellar/types";
import { previewOpen } from "@/lib/trade";
import { usePrefs } from "@/lib/ui/prefs";
import { useWallet } from "@/lib/wallet/store";

export function OrderTicket({ meta, cfg, price }: { meta: MarketMeta; cfg: MarketConfig; price: number }) {
  const { address, connect, connecting } = useWallet();
  const action = useChainAction();
  const balance = useUsdcBalance();
  const slippageBps = usePrefs((s) => s.slippageBps);

  const [side, setSide] = useState<Side>("Long");
  const [margin, setMargin] = useState("");
  const [leverage, setLeverage] = useState(Math.min(5, cfg.maxLeverage));

  const marginUnits = parseFloat(margin) || 0;
  const preview = useMemo(
    () => previewOpen({ cfg, price, marginUnits, leverage, side }),
    [cfg, price, marginUnits, leverage, side],
  );
  const balanceUnits = balance.data !== undefined ? toUnits(balance.data) : 0;
  const totalCost = marginUnits + preview.fee;

  const reason = !address
    ? null
    : marginUnits <= 0
      ? "Enter an amount"
      : !preview.meetsMin
        ? `Min size ${fmtUsd(cfg.minPositionSize)}`
        : totalCost > balanceUnits + 1e-6
          ? "Insufficient USDC"
          : null;

  const setMax = () => {
    const denom = 1 + (leverage * cfg.takerFeeBps) / 10_000;
    setMargin(Math.max(0, Math.floor((balanceUnits / denom) * 100) / 100).toString());
  };

  const submit = async () => {
    if (!address) return;
    await action.mutateAsync({
      call: calls.openPosition(
        address,
        cfg.id,
        side,
        toScaled(marginUnits),
        toScaled(preview.notional),
        BigInt(Math.round(price * 1e7)),
        slippageBps,
      ),
    });
    setMargin("");
  };

  return (
    <div className="space-y-4">
      <Segmented<Side>
        options={[
          { label: "Long", value: "Long" },
          { label: "Short", value: "Short" },
        ]}
        value={side}
        onChange={setSide}
        className={`w-full [&>button]:flex-1 ${side === "Long" ? "[&>button[data-on]]:text-long" : ""}`}
      />

      <AmountField
        label="Margin"
        value={margin}
        onChange={setMargin}
        onMax={address ? setMax : undefined}
        hint={
          address ? (
