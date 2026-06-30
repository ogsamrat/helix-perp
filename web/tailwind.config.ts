import type { Config } from "tailwindcss";

/**
 * Helix design tokens. Near-black canvas, three layered surface elevations
 * expressed via faint tints + 1px hairlines (no heavy shadows), one confident
 * gold accent (the RWA / FX narrative), strict long=green / short=red semantics.
 * Colors are space-separated RGB channels in CSS vars so `/<alpha>` works.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        elevated: "rgb(var(--elevated) / <alpha-value>)",
        hairline: "rgb(var(--hairline) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        "ink-muted": "rgb(var(--ink-muted) / <alpha-value>)",
        "ink-faint": "rgb(var(--ink-faint) / <alpha-value>)",
        brand: "rgb(var(--brand) / <alpha-value>)",
        "brand-muted": "rgb(var(--brand-muted) / <alpha-value>)",
        long: "rgb(var(--long) / <alpha-value>)",
        short: "rgb(var(--short) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "0.875rem", letterSpacing: "0.02em" }],
