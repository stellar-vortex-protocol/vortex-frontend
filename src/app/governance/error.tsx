"use client";

/**
 * Next.js error boundary for /governance — shown when GovernancePageClient
 * throws an unhandled error.  Issue #469.
 */

import { useEffect } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function GovernanceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error monitoring in production.
    console.error("[GovernanceError]", error);
  }, [error]);

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="Governance" />
      <main
        id="main-content"
        className="max-w-5xl mx-auto px-3 sm:px-5 py-12 text-center"
      >
        <div className="card p-8 space-y-4">
          <h1 className="text-xl font-bold text-vx-text">
            Unable to load governance proposals
          </h1>
          <p className="text-sm text-vx-muted">
            Something went wrong while fetching governance data. The backend
            relay may be temporarily unavailable.
          </p>
          {error.message && (
            <p className="font-mono text-xs text-vx-dim border border-vx-border rounded p-3 text-left">
              {error.message}
            </p>
          )}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 bg-vx-sage-bg text-vx-sage border border-vx-sage/30 rounded-lg text-sm font-semibold hover:bg-vx-sage/20 transition-colors"
            >
              Try again
            </button>
            <Link href="/" className="text-sm text-vx-muted hover:text-vx-text">
              ← Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
