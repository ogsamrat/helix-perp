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
        paper: "rgb(var(--paper) / <alpha-value>)",
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
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "0.875rem", letterSpacing: "0.02em" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 3px)",
        sm: "calc(var(--radius) - 5px)",
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(0 0 0 / 0.24), 0 1px 3px -1px rgb(0 0 0 / 0.18)",
        elevated: "0 2px 6px -2px rgb(0 0 0 / 0.4), 0 12px 28px -10px rgb(0 0 0 / 0.5)",
        pop: "0 16px 48px -16px rgb(0 0 0 / 0.65), 0 0 0 1px rgb(var(--hairline) / 0.9)",
        glow: "0 0 0 1px rgb(var(--brand) / 0.28), 0 10px 34px -10px rgb(var(--brand) / 0.28)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "flash-long": { "0%": { color: "rgb(var(--long))" }, "100%": {} },
        "flash-short": { "0%": { color: "rgb(var(--short))" }, "100%": {} },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "pulse-soft": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.45" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        "reveal-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "aurora-a": {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(12%,10%) scale(1.18)" },
        },
        "aurora-b": {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(-12%,8%) scale(1.12)" },
        },
        "aurora-c": {
          "0%,100%": { transform: "translate(0,0) scale(1.05)" },
          "50%": { transform: "translate(9%,-11%) scale(1.22)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "slide-up": "slide-up 0.25s cubic-bezier(0.16,1,0.3,1)",
        "flash-long": "flash-long 0.6s ease-out",
        "flash-short": "flash-short 0.6s ease-out",
        shimmer: "shimmer 1.6s infinite",
        "pulse-soft": "pulse-soft 1.8s ease-in-out infinite",
        marquee: "marquee 38s linear infinite",
        "reveal-up": "reveal-up 0.7s cubic-bezier(0.16,1,0.3,1) both",
        "aurora-a": "aurora-a 26s ease-in-out infinite",
        "aurora-b": "aurora-b 32s ease-in-out infinite",
        "aurora-c": "aurora-c 30s ease-in-out infinite",
        float: "float 7s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
