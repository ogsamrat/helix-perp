"use client";

/** A dependency-free SVG area+line chart for analytics. */
export function AreaChart({
  data,
  stroke = "rgb(var(--brand))",
  height = 160,
  className,
}: {
  data: number[];
  stroke?: string;
  height?: number;
  className?: string;
}) {
  const W = 100;
  const H = 40;
  if (data.length < 2) return <div style={{ height }} className={className} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / span) * (H - 4) - 2;
    return [x, y] as const;
