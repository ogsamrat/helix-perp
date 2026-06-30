"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Tabular numeric span. Always monospace + tabular so digits never jitter. */
export function Num({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("tnum", className)}>{children}</span>;
}

/** A live number that briefly flashes green/red when it ticks up/down. */
export function LiveNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
}) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (value > prev.current) setFlash("up");
    else if (value < prev.current) setFlash("down");
    prev.current = value;
    const t = setTimeout(() => setFlash(null), 650);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <span
      className={cn(
        "tnum transition-colors duration-500",
        flash === "up" && "text-long",
        flash === "down" && "text-short",
        className,
      )}
    >
      {format(value)}
    </span>
  );
}

/** Signed, colored PnL/percent text. */
export function Signed({
  positive,
  children,
  className,
  muted,
}: {
  positive: boolean;
  children: React.ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <span className={cn("tnum", positive ? "text-long" : "text-short", muted && "opacity-90", className)}>
      {children}
    </span>
  );
}
