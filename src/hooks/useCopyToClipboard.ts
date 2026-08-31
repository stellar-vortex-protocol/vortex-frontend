import { useCallback, useState } from "react";
import { useToastStore } from "@/store/toast";

const RESET_DELAY_MS = 1500;

export function useCopyToClipboard() {
  const addToast = useToastStore((s) => s.addToast);
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string, successMessage = "Copied to clipboard") => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        addToast(successMessage, "success");
        setCopied(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(false), RESET_DELAY_MS);
        return true;
      } catch {
        addToast("Couldn't copy to clipboard", "error");
        setCopied(false);
        return false;
      }
    },
    [addToast],
  );

  return { copy, copied };
}
