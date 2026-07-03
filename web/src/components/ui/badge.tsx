import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium",
  {
    variants: {
      variant: {
        neutral: "border-line bg-elevated text-ink-muted",
        long: "border-long/30 bg-long/15 text-long",
        short: "border-short/30 bg-short/15 text-short",
        brand: "border-brand/30 bg-brand/15 text-brand",
        warn: "border-warn/30 bg-warn/15 text-warn",
        outline: "border-line text-ink-muted",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
