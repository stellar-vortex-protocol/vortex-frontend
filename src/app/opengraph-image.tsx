/**
 * /opengraph-image
 *
 * Generated at build time via Next.js ImageResponse (Edge runtime).
 * Produces a 1200×630 Open Graph image using the Vortex brand palette.
 *
 * Shown when the site is shared on Slack, Twitter/X, Discord, iMessage, etc.
 */
import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Vortex — Cross-chain Swaps via Stellar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#080C14",
        position: "relative",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Radial sage glow — top centre */}
      <div
        style={{
          position: "absolute",
          top: -80,
          left: "50%",
          transform: "translateX(-50%)",
          width: 900,
          height: 500,
          background:
            "radial-gradient(ellipse at center, rgba(76,235,168,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Icon mark */}
      <svg
        viewBox="0 0 24 24"
        width={72}
        height={72}
        style={{ marginBottom: 32 }}
      >
        <rect width="24" height="24" rx="6" fill="#080C14" />
        <path
          d="M12 4L4 8.5l8 4 8-4-8-4.5zM4 16.5l8 4 8-4M4 12.5l8 4 8-4"
          stroke="#4CEBA8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {/* Wordmark */}
      <div
        style={{
          fontSize: 72,
          fontWeight: 800,
          color: "#E8EDF5",
          letterSpacing: "-2px",
          lineHeight: 1,
          marginBottom: 24,
        }}
      >
        Vortex
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 28,
          fontWeight: 400,
          color: "#6B7A8E",
          maxWidth: 680,
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        Cross-chain swaps directly to Stellar.{"\n"}
        Intent-based — no bridges, no wrapped tokens.
      </div>

      {/* Bottom pill badges */}
      <div
        style={{
          marginTop: 48,
          display: "flex",
          gap: 12,
        }}
      >
        {["Ethereum", "Base", "Polygon", "Arbitrum", "→ Stellar"].map(
          (label, i) => (
            <div
              key={label}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background:
                  i === 4 ? "rgba(76,235,168,0.08)" : "rgba(255,255,255,0.05)",
                border:
                  i === 4
                    ? "1px solid rgba(76,235,168,0.25)"
                    : "1px solid rgba(255,255,255,0.08)",
                color: i === 4 ? "#4CEBA8" : "#6B7A8E",
                fontSize: 16,
                fontWeight: 500,
              }}
            >
              {label}
            </div>
          ),
        )}
      </div>
    </div>,
    {
      ...size,
    },
  );
}
