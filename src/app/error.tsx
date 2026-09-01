"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log to an error reporting service in production.
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="Error" />

      <main
        id="main-content"
        className="max-w-2xl mx-auto px-5 py-24 text-center"
      >
        <div className="eyebrow mb-3">Something went wrong</div>
        <h1 className="text-3xl font-bold text-vx-text mb-3">
          An unexpected error occurred
        </h1>
        <p className="text-vx-muted text-sm mb-8">
          {error.message
            ? error.message
            : "We hit an unexpected error. Please try again or return home."}
        </p>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="text-sm px-4 py-2 rounded-lg bg-vx-sage text-vx-ink font-semibold
                       hover:brightness-110 transition-all"
          >
            Try again
          </button>
          <Link href="/" className="text-sm text-vx-sage hover:underline">
            ← Back to Vortex
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
