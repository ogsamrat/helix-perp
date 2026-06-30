"use client";
import { Coins } from "lucide-react";
import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useChainAction } from "@/hooks/use-chain";
import { toScaled } from "@/lib/format";
import { accountExists, fundWithFriendbot } from "@/lib/stellar/client";
import { calls } from "@/lib/stellar/contracts";
import { useToasts } from "@/lib/ui/toast";
import { useWallet } from "@/lib/wallet/store";

export function GetFundsButton({
  amount = 10_000,
  variant = "primary",
  size = "sm",
  className,
  label = "Get test funds",
}: {
  amount?: number;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  label?: string;
}) {
  const { address, connect } = useWallet();
  const action = useChainAction();
  const toast = useToasts();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!address) {
      await connect();
