"use client";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { sanitizeDisplayText } from "@/lib/textSafety";

export function CopyButton({
  value,
  label = "Copy to clipboard",
}: {
  value: string;
  label?: string;
}) {
  const { copy } = useCopyToClipboard();

  return (
    <button
      type="button"
      // Sanitize before copying: strip bidi-override and zero-width characters
      // so what goes into the clipboard is the visually honest string.
      onClick={() => copy(sanitizeDisplayText(value))}
      aria-label={label}
      className="inline-flex items-center justify-center text-vx-muted hover:text-vx-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage rounded"
    >
      <svg
        aria-hidden="true"
        className="w-3.5 h-3.5"
        viewBox="0 0 16 16"
        fill="none"
      >
        <rect
          x="5.5"
          y="5.5"
          width="8"
          height="8"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <path
          d="M3 10.5V3.5A1.5 1.5 0 0 1 4.5 2h7"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
