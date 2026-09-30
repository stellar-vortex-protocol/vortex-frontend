"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { VortexLogo } from "./VortexLogo";
import { ConnectWalletButton } from "./ConnectWalletButton";
import { SettingsPanel } from "./SettingsPanel";
import { useWalletStore } from "@/store/wallet";
import { useDismissableOverlay } from "@/hooks/useDismissableOverlay";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";

type NavProps = { variant: "home" } | { variant: "breadcrumb"; label: string };

const NAV_LINKS: { href: string; label: MessageKey }[] = [
  { href: "/explore", label: "nav.explore" },
  { href: "/analytics", label: "nav.analytics" },
  { href: "/solve", label: "nav.becomeSolver" },
  { href: "/contributors", label: "nav.contributors" },
];

export function Nav(props: NavProps) {
  const maxWidth = props.variant === "home" ? "max-w-6xl" : "max-w-5xl";
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isConnected = useWalletStore((s) => s.isConnected);
  const pathname = usePathname();

  // Escape / outside click close the mobile menu; Tab stays inside it.
  const panelRef = useDismissableOverlay<HTMLDivElement>({
    isOpen: mobileOpen,
    onClose: () => setMobileOpen(false),
    triggerRef: toggleRef,
  });

  const closeMobileMenu = () => {
    setMobileOpen(false);
    toggleRef.current?.focus();
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-vx-border bg-vx-ink/80 backdrop-blur-md">
      <div
        className={`${maxWidth} mx-auto px-5 h-14 flex items-center justify-between`}
      >
        {props.variant === "home" ? (
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <VortexLogo className="w-6 h-6 text-vx-sage" />
              <span className="font-semibold text-sm tracking-tight text-vx-text">{t("nav.branding")}</span>
            </div>
            <div className="hidden md:flex items-center gap-5 text-sm text-vx-muted">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors ${pathname === link.href ? "text-vx-text" : "hover:text-vx-text active:text-vx-sage"}`}
                >
                  {t(link.label)}
                </Link>
              ))}
              {isConnected && (
                <Link href="/my-intents" className={`transition-colors ${pathname === "/my-intents" ? "text-vx-text" : "hover:text-vx-text"}`}>
                  {t("nav.myIntents")}
                </Link>
              )}
              <a href="https://github.com/vortex-protocol" className="hover:text-vx-text transition-colors">
                {t("nav.docs")}
              </a>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <VortexLogo className="w-5 h-5 text-vx-sage" />
              <span className="font-semibold text-sm text-vx-text">{t("nav.branding")}</span>
            </Link>
            <span className="text-vx-dim">/</span>
            <span className="text-sm text-vx-muted">{props.label}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <SettingsPanel />
          <ConnectWalletButton compact={props.variant === "breadcrumb"} />
          {props.variant === "home" && (
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-panel"
              aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg border border-vx-border text-vx-muted hover:text-vx-text transition-colors"
            >
              <svg
                aria-hidden="true"
                className="w-4 h-4"
                viewBox="0 0 16 16"
                fill="none"
              >
                {mobileOpen ? (
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                ) : (
                  <path
                    d="M2 4h12M2 8h12M2 12h12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>
          )}
        </div>
      </div>

      {props.variant === "home" && mobileOpen && (
        <div
          ref={panelRef}
          id="mobile-nav-panel"
          className="md:hidden border-t border-vx-border bg-vx-ink/95 backdrop-blur-md px-5 py-3 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMobileMenu}
              className={`py-2 text-sm transition-colors ${pathname === link.href ? "text-vx-text" : "text-vx-muted hover:text-vx-text active:text-vx-sage"}`}
            >
              {t(link.label)}
            </Link>
          ))}
          {isConnected && (
            <Link
              href="/my-intents"
              onClick={() => setMobileOpen(false)}
              className={`py-2 text-sm transition-colors ${pathname === "/my-intents" ? "text-vx-text" : "text-vx-muted hover:text-vx-text"}`}
            >
              {t("nav.myIntents")}
            </Link>
          )}
          <a
            href="https://github.com/vortex-protocol"
            onClick={() => setMobileOpen(false)}
            className="py-2 text-sm text-vx-muted hover:text-vx-text transition-colors"
          >
            {t("nav.docs")}
          </a>
        </div>
      )}
    </nav>
  );
}
