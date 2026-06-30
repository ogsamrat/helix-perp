import { cn } from "@/lib/utils";

/** A labeled metric tile (used across analytics, vault, market stats). */
export function StatTile({
  label,
  value,
  sub,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-hairline bg-surface p-4", className)}>
      <p className="text-2xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="tnum mt-1.5 text-xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}

/** A compact key→value row for ticket previews and detail lists. */
export function StatRow({
  label,
  value,
  className,
  hint,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between py-1 text-sm", className)}>
      <span className="text-ink-muted" title={hint}>
        {label}
      </span>
      <span className="tnum text-ink">{value}</span>
    </div>
  );
}
