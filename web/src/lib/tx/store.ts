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
      args: rec.call.args,
      publicKey: address,
      sign,
      onHash: (hash) => {
        patch({ status: "pending", hash });
        toast.update(toastId, { description: "Submitted — confirming…", href: explorerTx(hash), hrefLabel: "View" });
      },
    });
    patch({ status: "confirmed", returnValue: res.returnValue });
    toast.update(toastId, {
      title: rec.label,
      description: "Confirmed",
      variant: "success",
      duration: 5000,
      href: explorerTx(res.hash),
      hrefLabel: "View on explorer",
    });
    setTimeout(() => toast.dismiss(toastId), 5000);
    onConfirmed?.(res);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    patch({ status: "failed", error: msg });
    toast.update(toastId, { title: rec.label + " failed", description: msg, variant: "error", duration: 8000 });
    setTimeout(() => toast.dismiss(toastId), 8000);
    return null;
  }
}

export const useTxStore = create<TxState>((set, get) => ({
  txs: [],
  submit: async (call, onConfirmed) => {
    const rec: TxRecord = {
      id: `tx${++seq}-${Date.now()}`,
      label: call.label,
      status: "signing",
      createdAt: Date.now(),
      call,
    };
    set((s) => ({ txs: [rec, ...s.txs].slice(0, 50) }));
    return run(set, get, rec, onConfirmed);
  },
  retry: async (id) => {
    const existing = get().txs.find((t) => t.id === id);
    if (!existing) return;
    const rec: TxRecord = {
      ...existing,
      id: `tx${++seq}-${Date.now()}`,
      status: "signing",
      error: undefined,
      hash: undefined,
      createdAt: Date.now(),
    };
    set((s) => ({ txs: [rec, ...s.txs].slice(0, 50) }));
    await run(set, get, rec);
  },
  clear: () => set(() => ({ txs: [] })),
}));
