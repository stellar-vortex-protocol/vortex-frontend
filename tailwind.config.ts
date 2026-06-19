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
        // Vortex palette: deep navy, sage accents
        "vx-ink":    "#080C14",
        "vx-base":   "#0C1120",
        "vx-surface":"#111827",
        "vx-card":   "#161E2E",
        "vx-border": "rgba(255,255,255,0.07)",
        "vx-line":   "rgba(255,255,255,0.04)",

        // Primary: sage green (Stellar brand adjacent)
        "vx-sage":     "#4CEBA8",
        "vx-sage-dim": "#2A8A62",
        "vx-sage-bg":  "rgba(76,235,168,0.08)",

        // Accent: soft lavender for source chain
        "vx-lav":      "#A78BFA",
        "vx-lav-dim":  "#5B3F8C",
        "vx-lav-bg":   "rgba(167,139,250,0.08)",

        // State colors
        "vx-amber":    "#F5A623",
        "vx-rose":     "#F87171",

        // Text
        "vx-text":     "#E8EDF5",
        "vx-muted":    "#6B7A8E",
        "vx-dim":      "#374151",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "vx-gradient": "linear-gradient(135deg, rgba(76,235,168,0.06) 0%, rgba(167,139,250,0.06) 100%)",
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
