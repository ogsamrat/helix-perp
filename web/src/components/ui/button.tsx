import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] active:duration-75",
  {
    variants: {
      variant: {
        primary: "brand-fill font-semibold text-[#1b1206] hover:brightness-[1.05] hover:glow-brand",
        secondary:
          "border border-line bg-elevated text-ink shadow-soft hover:border-ink-faint/70 hover:bg-elevated/70",
        ghost: "text-ink-muted hover:bg-elevated hover:text-ink",
        outline: "border border-line text-ink hover:border-ink-faint/70 hover:bg-elevated/60",
        long: "border border-long/25 bg-long/12 font-semibold text-long shadow-soft hover:border-long/45 hover:bg-long/20",
        short:
          "border border-short/25 bg-short/12 font-semibold text-short shadow-soft hover:border-short/45 hover:bg-short/20",
        danger: "bg-short font-semibold text-canvas hover:brightness-105",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-[15px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export { buttonVariants };
