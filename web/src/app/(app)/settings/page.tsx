"use client";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { GetFundsButton } from "@/components/shell/get-funds";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { StatRow } from "@/components/ui/stat";
import { CONFIG, explorerContract } from "@/config";
import { fmtBps, shortAddr } from "@/lib/format";
import { usePrefs } from "@/lib/ui/prefs";
import { useWallet } from "@/lib/wallet/store";

const CONTRACTS: [string, string][] = [
  ["Perp Engine", CONFIG.contracts.perpEngine],
  ["Market Registry", CONFIG.contracts.marketRegistry],
  ["Collateral Vault", CONFIG.contracts.collateralVault],
  ["Oracle Adapter", CONFIG.contracts.oracleAdapter],
  ["Mock USDC", CONFIG.contracts.mockUsdc],
  ["Mock Oracle", CONFIG.contracts.mockOracle],
];

export default function SettingsPage() {
  const { address, connect, disconnect, walletId } = useWallet();
  const { slippageBps, setSlippageBps, expertMode, setExpertMode } = usePrefs();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    setCopied(v);
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">Settings</h1>
        <p className="text-sm text-ink-muted">Wallet, network, trading preferences and protocol addresses.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Wallet</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {address ? (
              <>
                <StatRow label="Connected" value={<span className="tnum">{shortAddr(address, 6)}</span>} />
                <StatRow label="Wallet" value={walletId ?? "—"} />
                <div className="flex gap-2 pt-1">
                  <GetFundsButton variant="secondary" size="sm" />
                  <Button variant="ghost" size="sm" onClick={disconnect}>
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <Button variant="primary" onClick={() => connect()}>
                Connect wallet
              </Button>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Network</CardTitle>
            <Badge variant="brand">{CONFIG.network}</Badge>
          </CardHeader>
          <CardBody className="space-y-1">
            <StatRow label="Soroban RPC" value={<span className="tnum text-2xs">{CONFIG.rpcUrl.replace("https://", "")}</span>} />
            <StatRow label="Horizon" value={<span className="tnum text-2xs">{CONFIG.horizonUrl.replace("https://", "")}</span>} />
            <StatRow label="Passphrase" value={<span className="text-2xs">{CONFIG.networkPassphrase}</span>} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trading</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-ink-muted">Slippage tolerance</span>
                <span className="tnum text-ink">{fmtBps(slippageBps)}</span>
              </div>
              <div className="flex gap-2">
                {[10, 50, 100].map((b) => (
                  <button
                    key={b}
                    onClick={() => setSlippageBps(b)}
