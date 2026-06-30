"use client";
import {
  allowAllModules,
  FREIGHTER_ID,
  StellarWalletsKit,
  WalletNetwork,
} from "@creit.tech/stellar-wallets-kit";
import { create } from "zustand";
import { CONFIG } from "@/config";
import type { SignFn } from "@/lib/stellar/client";

const STORAGE_KEY = "helix:wallet";

let kit: StellarWalletsKit | null = null;

function getKit(): StellarWalletsKit {
  if (!kit) {
    kit = new StellarWalletsKit({
      network: CONFIG.network === "public" ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    });
  }
  return kit;
}

interface WalletState {
  address: string | null;
  walletId: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  restore: () => Promise<void>;
  sign: SignFn;
}

export const useWallet = create<WalletState>((set, get) => ({
  address: null,
  walletId: null,
  connecting: false,

  connect: async () => {
    set({ connecting: true });
    try {
      const k = getKit();
      await k.openModal({
        onWalletSelected: async (option) => {
          k.setWallet(option.id);
          const { address } = await k.getAddress();
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: option.id, address }));
          }
          set({ address, walletId: option.id });
        },
        onClosed: () => set({ connecting: false }),
      });
    } finally {
      set({ connecting: false });
    }
  },

  disconnect: () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    try {
      getKit().disconnect?.();
    } catch {
      /* noop */
    }
    set({ address: null, walletId: null });
  },

  restore: async () => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const { id, address } = JSON.parse(saved) as { id: string; address: string };
      getKit().setWallet(id);
      set({ address, walletId: id });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  },

  sign: async (xdr, opts) => {
    const k = getKit();
    const { address } = get();
    const res = await k.signTransaction(xdr, {
      address: opts.address ?? address ?? undefined,
      networkPassphrase: opts.networkPassphrase,
    });
    return { signedTxXdr: res.signedTxXdr };
  },
}));
