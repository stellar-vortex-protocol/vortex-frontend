import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vortex | Cross-chain Swaps via Stellar",
    short_name: "Vortex",
    description:
      "Swap any token from any chain directly to Stellar. Intent-based cross-chain liquidity protocol — no bridges, no wrapped tokens.",
    start_url: "/",
    display: "standalone",
    background_color: "#080C14",
    theme_color: "#080C14",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
