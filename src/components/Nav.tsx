"use client";

import Link from "next/link";
import { VortexLogo } from "./VortexLogo";
import { ConnectWalletButton } from "./ConnectWalletButton";

type NavProps = { variant: "home" } | { variant: "breadcrumb"; label: string };

export function Nav(props: NavProps) {
  const maxWidth = props.variant === "home" ? "max-w-6xl" : "max-w-5xl";

  return (
    <nav className="sticky top-0 z-50 border-b border-vx-border bg-vx-ink/80 backdrop-blur-md">
      <div className={`${maxWidth} mx-auto px-5 h-14 flex items-center justify-between`}>
        {props.variant === "home" ? (
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <VortexLogo className="w-6 h-6 text-vx-sage" />
              <span className="font-semibold text-sm tracking-tight text-vx-text">Vortex</span>
            </div>
            <div className="hidden md:flex items-center gap-5 text-sm text-vx-muted">
              <Link href="/explore" className="hover:text-vx-text transition-colors">
                Explore
              </Link>
              <Link href="/solve" className="hover:text-vx-text transition-colors">
                Become a Solver
              </Link>
              <a href="https://github.com/vortex-protocol" className="hover:text-vx-text transition-colors">
                Docs
              </a>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <VortexLogo className="w-5 h-5 text-vx-sage" />
              <span className="font-semibold text-sm text-vx-text">Vortex</span>
            </Link>
            <span className="text-vx-dim">/</span>
            <span className="text-sm text-vx-muted">{props.label}</span>
          </div>
        )}

        <ConnectWalletButton compact={props.variant === "breadcrumb"} />
      </div>
    </nav>
  );
}
