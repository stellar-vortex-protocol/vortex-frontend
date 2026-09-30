"use client";

import { useEffect } from "react";
import { secureLogger } from "@/lib/secureLogging";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useTranslation } from "@/lib/i18n/I18nProvider";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SolveError({ error, reset }: ErrorPageProps) {
  const { t } = useTranslation();
  useEffect(() => {
    secureLogger.error("Route error boundary caught an error", error);
  }, [error]);

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={t("errorPage.solve.breadcrumb")} />

      <main
        id="main-content"
        className="max-w-2xl mx-auto px-5 py-24 text-center"
      >
        <div className="eyebrow mb-3">{t("errorPage.solve.eyebrow")}</div>
        <h1 className="text-3xl font-bold text-vx-text mb-3">
          {t("errorPage.solve.title")}
        </h1>
        <p className="text-vx-muted text-sm mb-8">
          {error.message
            ? error.message
            : t("errorPage.solve.message")}
        </p>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="text-sm px-4 py-2 rounded-lg bg-vx-sage text-vx-ink font-semibold
                       hover:brightness-110 transition-all"
          >
            {t("common.tryAgain")}
          </button>
          <Link href="/" className="text-sm text-vx-sage hover:underline">
            {t("errorPage.solve.back")}
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
