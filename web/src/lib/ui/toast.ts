"use client";
import { create } from "zustand";

export type ToastVariant = "default" | "success" | "error" | "loading";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  href?: string;
  hrefLabel?: string;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id" | "duration"> & { id?: string; duration?: number }) => string;
  update: (id: string, patch: Partial<Toast>) => void;
  dismiss: (id: string) => void;
}

let seq = 0;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = t.id ?? `t${++seq}`;
    const toast: Toast = {
      id,
      title: t.title,
      description: t.description,
      variant: t.variant ?? "default",
      href: t.href,
      hrefLabel: t.hrefLabel,
      duration: t.duration ?? (t.variant === "loading" ? 0 : 5000),
    };
    set((s) => ({ toasts: [...s.toasts.filter((x) => x.id !== id), toast] }));
    if (toast.duration > 0) {
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), toast.duration);
    }
    return id;
  },
  update: (id, patch) =>
    set((s) => ({ toasts: s.toasts.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
