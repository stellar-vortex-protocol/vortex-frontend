"use client";

import { useMemo } from "react";
import { parseExternalUrl } from "@/lib/inputs";
import { secureLogger } from "@/lib/secureLogging";

interface ExternalLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** The destination URL — must pass `parseExternalUrl` validation. */
  href: string;
  /** Allowed origin overrides (defaults to the built-in whitelist). */
  allowedOrigins?: string[];
  /** Whether to show the destination host label (e.g. "github.com"). */
  showHostLabel?: boolean;
  children: React.ReactNode;
}

/**
 * ExternalLink enforces safe external navigation:
 * - `target="_blank"` and `rel="noopener noreferrer"` are always set.
 * - The `href` is validated against a whitelist of allowed origins.
 * - Invalid hrefs are dropped and a dev warning is emitted.
 * - When `showHostLabel` is true, the destination host is rendered
 *   alongside the link text so users can see where the link goes.
 */
export function ExternalLink({
  href,
  allowedOrigins,
  showHostLabel = false,
  children,
  className,
  ...rest
}: ExternalLinkProps) {
  const validated = useMemo(
    () => parseExternalUrl(href, allowedOrigins),
    [href, allowedOrigins],
  );

  if (!validated) {
    if (process.env.NODE_ENV === "development") {
      secureLogger.warn(
        `[ExternalLink] Dropping invalid external href: ${href}`,
      );
    }
    // Render children as plain text — no clickable link for untrusted URLs.
    return <span className={className}>{children}</span>;
  }

  const url = new URL(href);
  const hostLabel = showHostLabel ? ` (${url.host})` : "";

  return (
    <a
      href={href}
      className={className}
      {...rest}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      {hostLabel}
      <span aria-hidden="true" className="ml-1 inline-block">
        ↗
      </span>
    </a>
  );
}
