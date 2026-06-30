"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AmountField } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { StatRow } from "@/components/ui/stat";
import type { MarketMeta } from "@/config";
import { useChainAction } from "@/hooks/use-chain";
import { fmtLeverage, fmtPrice, fmtUsd, toScaled, toUnits } from "@/lib/format";
import { calls } from "@/lib/stellar/contracts";
import type { PositionView } from "@/lib/stellar/types";
import { useWallet } from "@/lib/wallet/store";

export function ManageDialog({
  position,
  meta,
  open,
  onClose,
}: {
  position: PositionView;
  meta: MarketMeta;
  open: boolean;
  onClose: () => void;
}) {
  const address = useWallet((s) => s.address);
  const action = useChainAction();
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [amt, setAmt] = useState("");

  const amount = parseFloat(amt) || 0;
  const marginUnits = toUnits(position.margin);
  const notionalUnits = toUnits(position.notional);
  const newMargin = mode === "add" ? marginUnits + amount : marginUnits - amount;
  const newLeverage = newMargin > 0 ? notionalUnits / newMargin : 0;

  const submit = async () => {
    if (!address || amount <= 0) return;
    const call =
      mode === "add"
        ? calls.addMargin(address, position.id, toScaled(amount))
        : calls.removeMargin(address, position.id, toScaled(amount));
