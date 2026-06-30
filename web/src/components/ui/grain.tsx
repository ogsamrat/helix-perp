/**
 * A whisper-quiet film grain overlay for tactile, print-like depth. Fixed,
 * non-interactive, blended so it reads as texture rather than noise.
 */
export function Grain() {
  const svg =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>`,
    );
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] opacity-[0.035] mix-blend-soft-light"
      style={{ backgroundImage: `url("${svg}")`, backgroundSize: "160px 160px" }}
    />
  );
}
