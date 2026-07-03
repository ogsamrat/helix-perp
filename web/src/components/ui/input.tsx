"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand/60 focus:ring-2 focus:ring-ring/20",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

/** A labeled amount field with a unit suffix + optional MAX action. */
export function AmountField({
  label,
  value,
  onChange,
  suffix = "USDC",
  hint,
  onMax,
  placeholder = "0.00",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  hint?: React.ReactNode;
  onMax?: () => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-muted">{label}</span>
        {hint}
      </div>
      <div className="group relative flex items-center rounded-md border border-line bg-canvas transition-colors focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-ring/20">
        <input
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          className="tnum h-11 w-full bg-transparent px-3 text-base text-ink outline-none placeholder:text-ink-faint"
        />
        {onMax && (
          <button
            onClick={onMax}
            className="focus-ring mr-1 rounded px-2 py-1 text-2xs font-semibold text-ink-muted hover:bg-elevated hover:text-ink"
          >
            MAX
          </button>
        )}
        <span className="px-3 text-sm font-medium text-ink-faint">{suffix}</span>
      </div>
    </div>
  );
}

/** Leverage slider with tick marks + live bubble. */
export function LeverageSlider({
  value,
  onChange,
  min = 1,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max: number;
}) {
  const marks = Array.from({ length: 5 }, (_, i) => Math.round(min + ((max - min) * i) / 4));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-muted">Leverage</span>
        <span className="tnum rounded bg-elevated px-2 py-0.5 font-semibold text-ink">{value.toFixed(1)}x</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="focus-ring h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-ink [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink [&::-webkit-slider-thumb]:shadow"
      />
      <div className="flex justify-between text-2xs text-ink-faint">
        {marks.map((m) => (
          <button key={m} onClick={() => onChange(m)} className="tnum hover:text-ink-muted">
            {m}x
          </button>
        ))}
      </div>
    </div>
  );
}
