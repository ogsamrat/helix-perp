/**
 * A living aurora backdrop — a few large, heavily-blurred color fields that drift
 * slowly behind everything. Sits at -z-10 (body is transparent), so it glows in
 * the page margins and through translucent chrome without touching the content.
 */
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-[12%] -top-[18%] h-[62vh] w-[62vh] animate-aurora-a rounded-full bg-brand/[0.13] blur-[130px]" />
      <div className="absolute -right-[8%] top-[6%] h-[52vh] w-[52vh] animate-aurora-b rounded-full bg-[rgb(184,126,64)]/[0.11] blur-[140px]" />
      <div className="absolute bottom-[-14%] left-[26%] h-[56vh] w-[56vh] animate-aurora-c rounded-full bg-[rgb(64,86,120)]/[0.09] blur-[150px]" />
      {/* fade the aurora toward the canvas at the edges for a clean vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,transparent_25%,rgb(var(--canvas)/0.55)_80%)]" />
    </div>
  );
}
