"use client";

import { useState } from "react";
import { encodeQrSvg } from "@/lib/qrCode";

export type QrCodeProps = {
  /** The string to encode (e.g. a Stellar address). */
  value: string;
  /**
   * Human-readable description of what the QR code encodes, used as the SVG
   * accessible name. Screen-reader users can't scan the code, but they should
   * know it's there and what it contains.
   * Example: "QR code for Stellar address GABC…XYZ"
   */
  label: string;
  /** Rendered size in pixels. Minimum 80 for scannability. Default 200. */
  size?: number;
};

/**
 * Inline SVG QR code with a show/hide toggle button.
 *
 * The toggle is suitable for embedding next to address displays — it keeps
 * the QR hidden until requested, avoiding visual clutter on desktop/keyboard
 * flows where the QR is less useful.
 */
export function QrCode({ value, label, size = 200 }: QrCodeProps) {
  const [visible, setVisible] = useState(false);

  // Encode eagerly so we can report encoding errors gracefully instead of
  // crashing the parent tree.
  let svgString: string | null = null;
  let encodeError: string | null = null;
  try {
    svgString = encodeQrSvg(value, { size });
  } catch (e) {
    encodeError = e instanceof Error ? e.message : "QR encoding failed";
  }

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-expanded={visible}
        aria-label={visible ? `Hide QR code for ${label}` : `Show QR code for ${label}`}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-vx-border
                   text-vx-muted hover:text-vx-text hover:border-vx-sage/40
                   text-xs transition-colors focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-vx-sage focus-visible:ring-offset-2
                   focus-visible:ring-offset-vx-ink"
      >
        {/* QR-code icon */}
        <svg
          aria-hidden="true"
          className="w-3.5 h-3.5 flex-shrink-0"
          viewBox="0 0 16 16"
          fill="none"
        >
          <rect x="1" y="1" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
          <rect x="3" y="3" width="1" height="1" fill="currentColor" />
          <rect x="10" y="1" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
          <rect x="12" y="3" width="1" height="1" fill="currentColor" />
          <rect x="1" y="10" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
          <rect x="3" y="12" width="1" height="1" fill="currentColor" />
          <rect x="10" y="10" width="3" height="3" stroke="currentColor" strokeWidth="1.2" />
          <rect x="14" y="10" width="1" height="1" fill="currentColor" />
          <rect x="14" y="14" width="1" height="1" fill="currentColor" />
          <rect x="10" y="14" width="1" height="1" fill="currentColor" />
        </svg>
        <span>{visible ? "Hide QR" : "Show QR"}</span>
      </button>

      {visible && (
        <div className="rounded-lg overflow-hidden border border-vx-border p-2 bg-white">
          {encodeError ? (
            <p className="text-xs text-red-500 p-2">{encodeError}</p>
          ) : svgString ? (
            <div
              // The SVG already contains role="img" — wrapping div keeps the
              // component self-contained without an extra ARIA role here.
              aria-label={label}
              dangerouslySetInnerHTML={{ __html: svgString }}
              style={{ width: size, height: size }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
