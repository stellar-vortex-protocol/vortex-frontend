// Message catalog for i18n
// Default English messages
export const messages = {
  footer: {
    copyright: "© 2025 Vortex Protocol · MIT License",
    github: "GitHub",
    discord: "Discord",
  },
  nav: {
    branding: "Vortex",
    explore: "Explore",
    analytics: "Analytics",
    becomeSolver: "Become a Solver",
    docs: "Docs",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
} as const;

export type MessageKey = keyof typeof messages;
export type MessageCatalog = typeof messages;
