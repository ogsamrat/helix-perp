"use client";
import { create } from "zustand";
import { explorerTx } from "@/config";
import { invokeContract } from "@/lib/stellar/client";
import type { Call } from "@/lib/stellar/contracts";
import { useToasts } from "@/lib/ui/toast";
import { useWallet } from "@/lib/wallet/store";

export type TxStatus = "signing" | "pending" | "confirmed" | "failed";

export interface TxRecord {
  id: string;
  label: string;
  status: TxStatus;
  hash?: string;
  error?: string;
  createdAt: number;
  call: Call;
  returnValue?: unknown;
}

export interface SubmitResult {
  hash: string;
  returnValue: unknown;
}

interface TxState {
  txs: TxRecord[];
  submit: (call: Call, onConfirmed?: (r: SubmitResult) => void) => Promise<SubmitResult | null>;
  retry: (id: string) => Promise<void>;
  clear: () => void;
}

let seq = 0;

async function run(
  set: (fn: (s: TxState) => Partial<TxState>) => void,
  get: () => TxState,
  rec: TxRecord,
  onConfirmed?: (r: SubmitResult) => void,
): Promise<SubmitResult | null> {
  const { address, sign } = useWallet.getState();
  const toast = useToasts.getState();
  const patch = (p: Partial<TxRecord>) =>
    set((s) => ({ txs: s.txs.map((t) => (t.id === rec.id ? { ...t, ...p } : t)) }));

  if (!address) {
    patch({ status: "failed", error: "Wallet not connected" });
    toast.push({ title: "Connect a wallet first", variant: "error" });
    return null;
  }

  const toastId = toast.push({ title: rec.label, description: "Waiting for signature…", variant: "loading" });
  try {
    const res = await invokeContract({
      contractId: rec.call.contractId,
      method: rec.call.method,
