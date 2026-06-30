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
