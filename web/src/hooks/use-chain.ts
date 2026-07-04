"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MARKETS } from "@/config";
import * as api from "@/lib/stellar/contracts";
import type { Call } from "@/lib/stellar/contracts";
import { fetchEvents } from "@/lib/stellar/events";
import { fetchLeaderboard } from "@/lib/stellar/indexer";
import { useTxStore, type SubmitResult } from "@/lib/tx/store";
import { useWallet } from "@/lib/wallet/store";

export function useMarkets() {
  return useQuery({ queryKey: ["markets"], queryFn: api.getAllMarkets, staleTime: 30_000 });
}

export function usePrices() {
  const feeds = MARKETS.map((m) => m.feed);
  return useQuery({
    queryKey: ["prices"],
    queryFn: () => api.getAllPrices(feeds),
    refetchInterval: 6_000,
  });
}

export function useMarketOi(id: number) {
  return useQuery({ queryKey: ["oi", id], queryFn: () => api.getMarketOi(id), refetchInterval: 10_000 });
}

export function useVaultStats() {
  return useQuery({ queryKey: ["vault"], queryFn: api.getVaultStats, refetchInterval: 8_000 });
}

export function usePositions() {
  const address = useWallet((s) => s.address);
  return useQuery({
    queryKey: ["positions", address],
    queryFn: () => api.getUserPositions(address!),
    enabled: !!address,
    refetchInterval: 6_000,
  });
}

export function useOrders() {
  const address = useWallet((s) => s.address);
  return useQuery({
    queryKey: ["orders", address],
    queryFn: () => api.getUserOrders(address!),
    enabled: !!address,
    refetchInterval: 6_000,
  });
}

export function useVaultShares() {
  const address = useWallet((s) => s.address);
  return useQuery({
    queryKey: ["shares", address],
    queryFn: () => api.getVaultShares(address!),
    enabled: !!address,
  });
}

export function useUsdcBalance() {
  const address = useWallet((s) => s.address);
  return useQuery({
    queryKey: ["balance", address],
    queryFn: () => api.getUsdcBalance(address!),
    enabled: !!address,
    refetchInterval: 10_000,
  });
}

export function useEvents() {
  return useQuery({ queryKey: ["events"], queryFn: () => fetchEvents(), refetchInterval: 7_000 });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboard,
    staleTime: 30_000,
    refetchInterval: 45_000,
  });
}

const DEFAULT_INVALIDATE = [
  "positions",
  "orders",
  "vault",
  "balance",
  "shares",
  "oi",
  "events",
  "prices",
];

/** Submit a contract call through the tx-lifecycle, then refresh chain queries. */
export function useChainAction() {
  const submit = useTxStore((s) => s.submit);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ call, invalidate }: { call: Call; invalidate?: string[] }) => {
      const res = await submit(call, () => {
        (invalidate ?? DEFAULT_INVALIDATE).forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      });
      if (!res) throw new Error("Transaction was not confirmed");
      return res as SubmitResult;
    },
  });
}
