import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vortex | Cross-chain Swaps via Stellar",
    short_name: "Vortex",
    description:
      "Swap any token from any chain directly to Stellar. Intent-based cross-chain liquidity protocol — no bridges, no wrapped tokens.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#080C14",
    theme_color: "#080C14",
    categories: ["finance", "utilities"],
    lang: "en",
    dir: "ltr",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/home-desktop.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
        label: "Vortex home — cross-chain swap",
      },
      {
        src: "/screenshots/home-mobile.png",
        sizes: "720x1280",
        type: "image/png",
        form_factor: "narrow",
        label: "Vortex home on mobile",
      },
    ],
    shortcuts: [
      {
        name: "Swap",
        short_name: "Swap",
        description: "Start a cross-chain swap to Stellar",
        url: "/swap",
        icons: [
          {
            src: "/icons/shortcut-swap-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "Explore",
        short_name: "Explore",
        description: "Browse cross-chain liquidity and analytics",
        url: "/explore",
        icons: [
          {
            src: "/icons/shortcut-explore-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "My Intents",
        short_name: "Intents",
        description: "Track your cross-chain intents",
        url: "/intents",
        icons: [
          {
            src: "/icons/shortcut-intents-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
  };
}
