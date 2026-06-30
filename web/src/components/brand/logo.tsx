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
