import { cn } from "@/lib/utils";

export function Mark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="helix-g" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgb(var(--brand))" />
          <stop offset="1" stopColor="rgb(var(--brand-muted))" />
        </linearGradient>
      </defs>
      <path
        d="M6 3c8 4 4 14 12 18"
        stroke="url(#helix-g)"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M18 3C10 7 14 17 6 21"
        stroke="url(#helix-g)"
        strokeWidth="2.1"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path d="M8.5 7.5h7M8.5 16.5h7" stroke="rgb(var(--brand))" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Mark />
      {showText && <span className="text-[15px] font-semibold tracking-tight text-ink">Helix</span>}
    </div>
  );
}
