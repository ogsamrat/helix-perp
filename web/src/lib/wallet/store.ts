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
