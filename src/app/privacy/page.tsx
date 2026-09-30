"use client";

import { useCallback, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { useWalletStore } from "@/store/wallet";
import {
  STORAGE_WARN_BYTES,
  clearAll,
  clearKey,
  exportData,
  isPrivateMode,
  listEntries,
  onStorageChange,
  setPrivateMode,
  totalBytes,
  type StorageEntry,
} from "@/lib/storage";

const DAY_MS = 24 * 60 * 60 * 1000;

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

const buttonClass =
  "text-xs px-3 py-1.5 rounded-md border border-vx-border text-vx-text hover:border-vx-sage/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage";

export default function PrivacyPage() {
  const { t, locale } = useTranslation();
  const [entries, setEntries] = useState<StorageEntry[]>([]);
  const [privateMode, setPrivateModeState] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [status, setStatus] = useState("");

  const refresh = useCallback(() => {
    setEntries(listEntries());
    setPrivateModeState(isPrivateMode());
  }, []);

  useEffect(() => {
    refresh();
    return onStorageChange(refresh);
  }, [refresh]);

  const handleClear = (key: string) => {
    clearKey(key);
    setStatus(t("privacy.status.cleared", { key }));
    refresh();
  };

  const handleClearAll = () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      return;
    }
    useWalletStore.getState().disconnect();
    clearAll();
    setConfirmClearAll(false);
    setStatus(t("privacy.status.clearedAll"));
    refresh();
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vortex-local-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(t("privacy.status.exported"));
  };

  const handlePrivateMode = () => {
    setPrivateMode(!privateMode);
    refresh();
  };

  const used = totalBytes(entries);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={t("privacy.title")} />
      <main id="main-content" className="max-w-5xl mx-auto px-5 py-12">
        <div className="mb-8">
          <div className="eyebrow mb-3">{t("privacy.eyebrow")}</div>
          <h1 className="text-3xl font-bold text-vx-text mb-3">{t("privacy.title")}</h1>
          <p className="text-vx-muted text-sm max-w-2xl">{t("privacy.intro")}</p>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {status}
        </p>

        {used > STORAGE_WARN_BYTES && (
          <p role="alert" className="card p-4 mb-6 text-sm text-vx-amber">
            {t("privacy.capWarning", { size: formatBytes(used) })}
          </p>
        )}

        <section className="card p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 id="private-mode-label" className="text-base font-semibold text-vx-text">
              {t("privacy.privateMode.title")}
            </h2>
            <p id="private-mode-desc" className="text-xs text-vx-muted mt-1 max-w-xl">
              {t("privacy.privateMode.description")}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={privateMode}
            aria-labelledby="private-mode-label"
            aria-describedby="private-mode-desc"
            onClick={handlePrivateMode}
            className={`${buttonClass} ${privateMode ? "bg-vx-sage text-vx-ink border-vx-sage" : ""}`}
          >
            {privateMode ? t("privacy.privateMode.on") : t("privacy.privateMode.off")}
          </button>
        </section>

        <section className="card overflow-hidden mb-6" aria-labelledby="inventory-heading">
          <div className="px-5 py-4 border-b border-vx-border flex flex-wrap items-center justify-between gap-3">
            <h2 id="inventory-heading" className="text-base font-semibold text-vx-text">
              {t("privacy.inventory.title")}
            </h2>
            <span className="text-xs text-vx-muted">
              {t("privacy.inventory.total", { count: entries.length, size: formatBytes(used) })}
            </span>
          </div>
          {entries.length === 0 ? (
            <p className="p-5 text-sm text-vx-muted">{t("privacy.inventory.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-vx-muted uppercase text-[10px] tracking-wider">
                  <tr>
                    <th scope="col" className="px-5 py-3">{t("privacy.col.key")}</th>
                    <th scope="col" className="px-5 py-3">{t("privacy.col.purpose")}</th>
                    <th scope="col" className="px-5 py-3">{t("privacy.col.retention")}</th>
                    <th scope="col" className="px-5 py-3">{t("privacy.col.size")}</th>
                    <th scope="col" className="px-5 py-3">{t("privacy.col.updated")}</th>
                    <th scope="col" className="px-5 py-3"><span className="sr-only">{t("privacy.col.actions")}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-vx-line">
                  {entries.map((entry) => (
                    <tr key={`${entry.location}:${entry.key}`}>
                      <td className="px-5 py-3 font-mono text-vx-text">
                        {entry.key}
                        {entry.location === "session" && (
                          <span className="ml-2 text-[10px] text-vx-muted">{t("privacy.sessionOnly")}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-vx-muted">
                        {entry.def ? t(entry.def.purpose) : t("privacy.legacy")}
                      </td>
                      <td className="px-5 py-3 text-vx-muted">
                        {entry.def?.retentionMs
                          ? t("privacy.retention.days", { days: Math.round(entry.def.retentionMs / DAY_MS) })
                          : t("privacy.retention.untilCleared")}
                      </td>
                      <td className="px-5 py-3 text-vx-muted num">{formatBytes(entry.bytes)}</td>
                      <td className="px-5 py-3 text-vx-muted">
                        {entry.updatedAt ? dateFormat.format(entry.updatedAt) : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          className={buttonClass}
                          onClick={() => handleClear(entry.key)}
                          aria-label={t("privacy.clearKeyAria", { key: entry.key })}
                        >
                          {t("privacy.clear")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={handleExport}>
            {t("privacy.export")}
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className={`${buttonClass} border-red-400/50 text-red-400`}
          >
            {confirmClearAll ? t("privacy.clearAll.confirm") : t("privacy.clearAll")}
          </button>
          {confirmClearAll && (
            <button type="button" className={buttonClass} onClick={() => setConfirmClearAll(false)}>
              {t("privacy.clearAll.cancel")}
            </button>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
