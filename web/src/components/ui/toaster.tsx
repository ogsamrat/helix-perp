"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useToasts, type ToastVariant } from "@/lib/ui/toast";

const ICONS: Record<ToastVariant, React.ReactNode> = {
  default: <CheckCircle2 className="h-4 w-4 text-ink-muted" />,
  success: <CheckCircle2 className="h-4 w-4 text-long" />,
  error: <XCircle className="h-4 w-4 text-short" />,
  loading: <Loader2 className="h-4 w-4 animate-spin text-brand" />,
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto overflow-hidden rounded-xl border border-hairline bg-elevated shadow-pop"
          >
            <div className="flex items-start gap-3 p-3">
              <div className="mt-0.5 shrink-0">{ICONS[t.variant]}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{t.title}</p>
                {t.description && <p className="mt-0.5 break-words text-xs text-ink-muted">{t.description}</p>}
                {t.href && (
                  <a
                    href={t.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-2xs font-medium text-brand hover:underline"
                  >
                    {t.hrefLabel ?? "View"} <ArrowUpRight className="h-3 w-3" />
                  </a>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-ink-faint transition-colors hover:text-ink"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
