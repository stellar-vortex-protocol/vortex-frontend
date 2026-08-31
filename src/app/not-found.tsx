import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { getTranslation } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Page Not Found",
};

export default function NotFound() {
  const { t } = getTranslation();

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={t("notFound.breadcrumb")} />

      <main
        id="main-content"
        className="max-w-2xl mx-auto px-5 py-24 text-center"
      >
        <div className="eyebrow mb-3">{t("notFound.eyebrow")}</div>
        <h1 className="text-3xl font-bold text-vx-text mb-3">
          {t("notFound.title")}
        </h1>
        <p className="text-vx-muted text-sm mb-8">{t("notFound.body")}</p>
        <Link href="/" className="text-sm text-vx-sage hover:underline">
          {t("notFound.backHome")}
        </Link>
      </main>

      <Footer />
    </div>
  );
}
