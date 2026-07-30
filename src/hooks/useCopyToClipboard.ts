import { useCallback } from "react";
import { useToastStore } from "@/store/toast";

export function useCopyToClipboard() {
  const addToast = useToastStore((s) => s.addToast);

  const copy = useCallback(
    async (text: string, successMessage = "Copied to clipboard") => {
      try {
        await navigator.clipboard.writeText(text);
        addToast(successMessage, "success");
        return true;
      } catch {
        addToast("Couldn't copy to clipboard", "error");
        return false;
      }
    },
    [addToast]
  );

  return { copy };
}
