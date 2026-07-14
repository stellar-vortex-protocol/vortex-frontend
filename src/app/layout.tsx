import type { Metadata } from "next";
import "./globals.css";
import { WalletHydrator } from "@/components/WalletHydrator";
import { ToastViewport } from "@/components/ToastViewport";

export const metadata: Metadata = {
  title: "Vortex | Cross-chain Swaps via Stellar",
  description:
    "Swap any token from any chain directly to Stellar. Intent-based cross-chain liquidity protocol — no bridges, no wrapped tokens.",
  keywords: ["stellar", "cross-chain", "bridge", "swap", "intents", "defi", "soroban"],
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
        <WalletHydrator />
        {children}
        <ToastViewport />
      </body>
    </html>
  );
}
