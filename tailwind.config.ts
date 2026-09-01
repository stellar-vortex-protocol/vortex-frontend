import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Vortex semantic palette ──────────────────────────────────────────
        // All values are CSS-variable references so that globals.css can switch
        // the entire palette by redefining the variables in a light-theme block.
        "vx-ink":     "var(--vx-ink)",
        "vx-base":    "var(--vx-base)",
        "vx-surface": "var(--vx-surface)",
        "vx-card":    "var(--vx-card)",
        "vx-border":  "var(--vx-border)",
        "vx-line":    "var(--vx-line)",

        // Primary: sage green (Stellar brand adjacent)
        "vx-sage":     "var(--vx-sage)",
        "vx-sage-dim": "var(--vx-sage-dim)",
        "vx-sage-bg":  "var(--vx-sage-bg)",

        // Accent: soft lavender for source chain
        "vx-lav":     "var(--vx-lav)",
        "vx-lav-dim": "var(--vx-lav-dim)",
        "vx-lav-bg":  "var(--vx-lav-bg)",

        // State colors
        "vx-amber": "var(--vx-amber)",
        "vx-rose":  "var(--vx-rose)",

        // Text
        "vx-text":  "var(--vx-text)",
        "vx-muted": "var(--vx-muted)",
        "vx-dim":   "var(--vx-dim)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "vx-gradient":      "linear-gradient(135deg, rgba(76,235,168,0.06) 0%, rgba(167,139,250,0.06) 100%)",
        "vx-card-gradient": "linear-gradient(160deg, rgba(76,235,168,0.03) 0%, transparent 60%)",
      },
      keyframes: {
        "flow": {
          "0%":   { strokeDashoffset: "100" },
          "100%": { strokeDashoffset: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to:   { transform: "rotate(360deg)" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "flow":      "flow 1.5s linear infinite",
        "fade-up":   "fade-up 0.3s ease-out",
        "spin-slow": "spin-slow 3s linear infinite",
        "shimmer":   "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
