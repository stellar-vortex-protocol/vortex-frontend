import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletHydrator } from "@/components/WalletHydrator";
import { ToastViewport } from "@/components/ToastViewport";
import { CommandPalette } from "@/components/CommandPalette";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { DEFAULT_LOCALE } from "@/lib/i18n";

const TITLE = "Vortex | Cross-chain Swaps via Stellar";
const DESCRIPTION =
  "Swap any token from any chain directly to Stellar. Intent-based cross-chain liquidity protocol — no bridges, no wrapped tokens.";

// The canonical site URL — used in absolute OG image URLs.
// Falls back to localhost for local dev; set NEXT_PUBLIC_SITE_URL in production.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: { default: TITLE, template: "%s | Vortex" },
  description: DESCRIPTION,
  keywords: ["stellar", "cross-chain", "bridge", "swap", "intents", "defi", "soroban"],

  // ── Favicon set ──────────────────────────────────────────────────────────────
  // Two SVG variants: dark background for dark browser chrome (prefers dark),
  // light background for light browser chrome (prefers light).
  // Next.js App Router picks up src/app/icon.svg automatically, but we need
  // the media-query variants registered here so browsers receive both.
  icons: {
    icon: [
      {
        // Dark browser chrome (OS in dark mode) — dark icon looks crisp
        url: "/icon-dark.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
      {
        // Light browser chrome (OS in light mode) — light-bg icon stands out
        url: "/icon-light.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      // Fallback for browsers that don't support the media attribute
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },

  // ── Open Graph ───────────────────────────────────────────────────────────────
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Vortex",
    type: "website",
    url: SITE_URL,
    images: [
      {
        // Next.js generates this from src/app/opengraph-image.tsx at build time
        url: `${SITE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Vortex — Cross-chain Swaps via Stellar",
      },
    ],
  },

  // ── Twitter / X ──────────────────────────────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE_URL}/opengraph-image`],
  },
};

export const viewport: Viewport = {
  // Dark-navy theme colour — used by Chrome on Android and Safari on iOS
  // for the browser chrome surrounding the page.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#080C14" },
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-vx-ink text-vx-text antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200]
                     focus:px-3 focus:py-2 focus:rounded-lg focus:bg-vx-card focus:text-vx-text
                     focus:border focus:border-vx-sage/40"
        >
          Skip to main content
        </a>
        <I18nProvider locale={DEFAULT_LOCALE}>
          <WalletHydrator />
          {children}
          <CommandPalette />
          <ToastViewport />
        </I18nProvider>
      </body>
    </html>
  );
}
