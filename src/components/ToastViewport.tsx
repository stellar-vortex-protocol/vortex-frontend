"use client";

import Link from "next/link";
import { useToastStore, type ToastVariant } from "@/store/toast";

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-vx-sage/40 bg-vx-sage-bg text-vx-sage",
  error: "border-red-500/40 bg-red-500/10 text-red-300",
  info: "border-vx-border bg-vx-card text-vx-text",
};

export function ToastViewport() {
  const { toasts, dismissToast, pauseToast, resumeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.variant === "error" ? "alert" : "status"}
          tabIndex={-1}
          onMouseEnter={() => pauseToast(toast.id)}
          onMouseLeave={() => resumeToast(toast.id)}
          onFocus={() => pauseToast(toast.id)}
          onBlur={() => resumeToast(toast.id)}
          onKeyDown={(e) => {
            if (e.key === "Escape") dismissToast(toast.id);
          }}
          className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm shadow-lg animate-fade-up ${VARIANT_STYLES[toast.variant]}`}
        >
          {toast.href ? (
            <Link href={toast.href} className="flex-1 underline underline-offset-2">
              {toast.message}
            </Link>
          ) : (
            <span className="flex-1">{toast.message}</span>
          )}
          <button
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
            className="text-current opacity-60 hover:opacity-100 transition-opacity"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
