import type { Metadata } from "next";
import "./globals.css";
import { WalletHydrator } from "@/components/WalletHydrator";

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
        <WalletHydrator />
        {children}
      </body>
    </html>
  );
}
