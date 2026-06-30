"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MARKETS } from "@/config";
import * as api from "@/lib/stellar/contracts";
import type { Call } from "@/lib/stellar/contracts";
import { fetchEvents } from "@/lib/stellar/events";
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
