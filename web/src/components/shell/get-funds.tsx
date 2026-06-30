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
      return;
    }
    setBusy(true);
    try {
      if (!(await accountExists(address))) {
        const id = toast.push({
          title: "Activating account",
          description: "Friendbot is creating your testnet account…",
          variant: "loading",
        });
        await fundWithFriendbot(address);
        toast.update(id, { title: "Account funded", description: "Minting test USDC…", variant: "success", duration: 3000 });
        setTimeout(() => toast.dismiss(id), 3000);
      }
      await action.mutateAsync({ call: calls.faucet(address, toScaled(amount)) });
    } catch (e) {
      toast.push({
        title: "Couldn't get funds",
        description: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant={variant} size={size} className={className} loading={busy || action.isPending} onClick={onClick}>
      <Coins className="h-4 w-4" />
      {label}
    </Button>
  );
}
