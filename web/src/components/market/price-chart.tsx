"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createChart, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { useEffect, useRef } from "react";

const COL = {
  up: "rgb(46,199,133)",
  down: "rgb(240,105,118)",
  text: "rgb(142,149,162)",
  grid: "rgba(46,51,61,0.35)",
};

function seed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Synthetic-but-consistent candles anchored so the final close equals `price`. */
function buildCandles(feed: string, price: number, n = 120) {
  const r = rng(seed(feed));
  const closes: number[] = [1];
  for (let i = 1; i < n; i++) closes.push(closes[i - 1] * (1 + (r() - 0.5) * 0.022));
  const factor = price / closes[n - 1];
  const start = Math.floor(Date.now() / 1000) - n * 3600;
  return closes.map((c, i) => {
    const close = c * factor;
    const open = (i === 0 ? c : closes[i - 1]) * factor;
    const hi = Math.max(open, close) * (1 + r() * 0.006);
    const lo = Math.min(open, close) * (1 - r() * 0.006);
    return { time: (start + i * 3600) as any, open, high: hi, low: lo, close };
  });
}

export function PriceChart({ feed, price, decimals }: { feed: string; price: number; decimals: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lastRef = useRef<any>(null);

  useEffect(() => {
    if (!ref.current || price <= 0) return;
    const chart = createChart(ref.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: COL.text, fontFamily: "var(--font-mono)" },
      grid: { vertLines: { color: COL.grid }, horzLines: { color: COL.grid } },
      rightPriceScale: { borderColor: "transparent" },
      timeScale: { borderColor: "transparent", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
    });
    const series = chart.addCandlestickSeries({
      upColor: COL.up,
      downColor: COL.down,
      borderUpColor: COL.up,
      borderDownColor: COL.down,
      wickUpColor: COL.up,
      wickDownColor: COL.down,
      priceFormat: { type: "price", precision: decimals, minMove: 1 / 10 ** decimals },
    });
    const data = buildCandles(feed, price);
    series.setData(data);
    lastRef.current = data[data.length - 1];
    chart.timeScale().fitContent();
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // rebuild only when the market (feed) changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed]);

  // live-update the last candle as the oracle price ticks
  useEffect(() => {
    const s = seriesRef.current;
    const last = lastRef.current;
    if (!s || !last || price <= 0) return;
    const updated = {
      ...last,
      close: price,
      high: Math.max(last.high, price),
      low: Math.min(last.low, price),
    };
    lastRef.current = updated;
    s.update(updated);
  }, [price]);

  return <div ref={ref} className="h-full w-full" />;
}
