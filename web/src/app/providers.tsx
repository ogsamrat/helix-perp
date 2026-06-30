"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { usePrices } from "@/hooks/use-chain";
import { toUnits } from "@/lib/format";
import { useLivePriceStore } from "@/lib/ui/live-price";
import { useWallet } from "@/lib/wallet/store";

/** Drives the live mark prices: re-anchors to on-chain prices, ticks every second. */
function LivePriceEngine() {
  const prices = usePrices();
  const setAnchor = useLivePriceStore((s) => s.setAnchor);
  const step = useLivePriceStore((s) => s.step);

  useEffect(() => {
    if (!prices.data) return;
    for (const [feed, p] of Object.entries(prices.data)) setAnchor(feed, toUnits(p.price));
  }, [prices.data, setAnchor]);

  useEffect(() => {
    const id = setInterval(step, 1000);
    return () => clearInterval(id);
  }, [step]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 4_000,
            refetchInterval: 8_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );
  const restore = useWallet((s) => s.restore);
  useEffect(() => {
    void restore();
  }, [restore]);

  return (
    <QueryClientProvider client={qc}>
      <LivePriceEngine />
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
