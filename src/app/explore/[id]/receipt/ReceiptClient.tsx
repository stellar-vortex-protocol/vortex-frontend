"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { QrCode } from "@/components/QrCode";
import { IntentStatusBadge } from "@/components/IntentStatusBadge";
import { SkeletonDetailCard } from "@/components/Skeleton";
import { useIntent } from "@/hooks/useIntent";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useLocale, useTranslation } from "@/lib/i18n/I18nProvider";
import { buildReceipt, receiptToText } from "@/lib/receipt";

const NETWORK = process.env["NEXT_PUBLIC_NETWORK"] ?? "testnet";

const buttonClass =
  "print:hidden text-xs px-3 py-1.5 rounded-lg border border-vx-border text-vx-muted hover:text-vx-text hover:border-vx-sage/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage";

export default function ReceiptClient({ id }: { id: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { intent, isLoading, error } = useIntent(id);
  const { copy, copied } = useCopyToClipboard();

  const receipt = useMemo(
    () => (intent && intent.status === "filled" ? buildReceipt(intent, locale, NETWORK) : null),
    [intent, locale],
  );

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={t("receipt.title")} />

      <main id="main-content" className="max-w-3xl mx-auto px-5 py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/explore/${id}`} className="text-xs text-vx-sage hover:underline">
            ← {t("receipt.back")}
          </Link>
          {receipt && (
            <div className="flex gap-2">
              <button type="button" className={buttonClass} onClick={() => void copy(receiptToText(receipt))}>
                {copied ? t("receipt.copied") : t("receipt.copy")}
              </button>
              <button type="button" className={buttonClass} onClick={() => window.print()}>
                {t("receipt.print")}
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <SkeletonDetailCard />
        ) : error || !intent ? (
          <div role="alert" className="card p-8 text-center text-sm text-vx-muted">
            {t("receipt.notFound")}
          </div>
        ) : !receipt ? (
          <div className="card p-8 text-center space-y-3">
            <IntentStatusBadge status={intent.status} />
            <p className="text-sm text-vx-muted">{t("receipt.notFilled", { status: intent.status })}</p>
          </div>
        ) : (
          <article id="intent-receipt" className="card p-6 space-y-6 receipt">
            <header className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow mb-2">{t("receipt.title")}</div>
                <h1 className="text-xl font-bold text-vx-text break-all">{receipt.intentId}</h1>
              </div>
              {receipt.explorerUrl && (
                <QrCode value={receipt.explorerUrl} label={t("receipt.qrLabel")} size={120} defaultVisible />
              )}
            </header>

            <dl className="grid sm:grid-cols-2 gap-3">
              {receipt.lines.map((line) => (
                <div key={line.label} className="bg-vx-surface/40 rounded-lg p-3 break-inside-avoid">
                  <dt className="eyebrow mb-1">{line.label}</dt>
                  <dd className="text-sm text-vx-text num break-all">
                    {line.label === "Explorer" ? (
                      <a href={line.value} target="_blank" rel="noopener noreferrer" className="text-vx-sage hover:underline">
                        {line.value}
                      </a>
                    ) : (
                      line.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            <p role="note" className="text-xs text-vx-muted border-t border-vx-line pt-4">
              {t("receipt.disclaimer")}
            </p>
          </article>
        )}
      </main>

      <Footer />
    </div>
  );
}
