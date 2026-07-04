import { cn } from "@/lib/utils";

/**
 * The Helix mark — two ribbons crossing into an "X" (the double-helix twist),
 * with a single gold accent on the upper strand. Traced to a flat 2-colour vector
 * so it stays crisp at any size and recolours via `currentColor`.
 */
const MARK_D =
  "M84.95,99.87 76.15,89.29 70.66,83.80 64.54,79.46 6.63,49.36 1.66,46.17 -0.13,42.35 0.00,0.13 19.01,12.76 19.77,14.54 19.77,34.44 21.43,36.86 80.87,69.26 83.29,71.17 85.08,75.26 84.95,99.87Z M62.50,57.78 42.98,47.19 65.18,33.67 65.18,14.80 65.94,13.01 84.95,-0.13 85.08,41.58 84.31,44.39 81.38,47.58 62.50,57.78Z M0.26,100.13 -0.13,75.51 0.38,73.21 2.81,70.54 23.47,59.31 42.22,69.13 14.80,84.57 0.26,100.13Z";
const GOLD_D = "M46.68,48.85 43.49,46.94 82.78,22.19 82.02,26.53 78.06,30.48 46.68,48.85Z";

export function Mark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      height={size}
      width={(size * 85) / 100}
      viewBox="-1 -1 87 102"
      className={cn("text-ink", className)}
      aria-hidden
    >
      <path d={MARK_D} fill="currentColor" />
      <path d={GOLD_D} fill="rgb(var(--brand))" />
    </svg>
  );
}

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Mark />
      {showText && (
        <span className="text-[15px] font-semibold tracking-tight text-ink">Helix</span>
      )}
    </div>
  );
}
