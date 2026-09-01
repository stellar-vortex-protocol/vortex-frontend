"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function IntentDetailError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="Intent Detail — Error" />

      <main
        id="main-content"
        className="max-w-2xl mx-auto px-5 py-24 text-center"
      >
        <div className="eyebrow mb-3">Intent Detail</div>
        <h1 className="text-3xl font-bold text-vx-text mb-3">
          Couldn&apos;t load this intent
        </h1>
        <p className="text-vx-muted text-sm mb-8">
          {error.message
            ? error.message
            : "There was a problem loading the intent details. It may have been removed or the ID may be invalid."}
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
          <Link href="/explore" className="text-sm text-vx-sage hover:underline">
            ← Back to Explorer
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
