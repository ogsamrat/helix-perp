"use client";
import { create } from "zustand";

const KEY = "helix:prefs";

interface Prefs {
  slippageBps: number;
  expertMode: boolean;
  setSlippageBps: (n: number) => void;
  setExpertMode: (b: boolean) => void;
}

function load(): { slippageBps: number; expertMode: boolean } {
  if (typeof window === "undefined") return { slippageBps: 50, expertMode: false };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { slippageBps: 50, expertMode: false, ...JSON.parse(raw) };
  } catch {
    /* noop */
  }
  return { slippageBps: 50, expertMode: false };
}

function persist(p: { slippageBps: number; expertMode: boolean }) {
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(p));
}

export const usePrefs = create<Prefs>((set, get) => ({
  ...load(),
  setSlippageBps: (n) => {
    set({ slippageBps: n });
    persist({ slippageBps: n, expertMode: get().expertMode });
  },
  setExpertMode: (b) => {
    set({ expertMode: b });
    persist({ slippageBps: get().slippageBps, expertMode: b });
  },
}));
