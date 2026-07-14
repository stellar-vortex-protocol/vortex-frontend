import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
};

export const TOAST_DURATION_MS = 4000;

type ToastState = {
  toasts: Toast[];
  addToast: (message: string, variant?: ToastVariant) => string;
  dismissToast: (id: string) => void;
};

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (message, variant = "info") => {
    const id = crypto.randomUUID();
    set({ toasts: [...get().toasts, { id, message, variant }] });
    setTimeout(() => get().dismissToast(id), TOAST_DURATION_MS);
    return id;
  },

  dismissToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));
