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
