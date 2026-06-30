import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Sleep helper for polling loops. */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Clamp a number to [min, max]. */
export const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
