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
