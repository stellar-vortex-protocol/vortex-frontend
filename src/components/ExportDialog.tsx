"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { useDismissableOverlay } from "@/hooks/useDismissableOverlay";
import { secureLogger } from "@/lib/secureLogging";
import { downloadBlob, startExport, type ExportJob } from "@/lib/export/client";
import {
  EXPORT_COLUMNS,
  applyFilenameTemplate,
  filterByDateRange,
  type ExportColumn,
  type ExportFormat,
} from "@/lib/export/serialize";
import type { FeedItem } from "@/lib/types";

const NETWORK = process.env["NEXT_PUBLIC_NETWORK"] ?? "testnet";

type Props = {
  /** The loaded (already filtered) list. The API is not paginated, so only loaded data is exported. */
  items: FeedItem[];
  filenameBase: string;
};

export function ExportDialog({ items, filenameBase }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [columns, setColumns] = useState<ExportColumn[]>([...EXPORT_COLUMNS]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [template, setTemplate] = useState(`${filenameBase}-{date}`);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const jobRef = useRef<ExportJob | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useDismissableOverlay<HTMLDivElement>({
    isOpen: open,
    onClose: () => setOpen(false),
    triggerRef,
  });

  const rows = useMemo(() => filterByDateRange(items, from || undefined, to || undefined), [items, from, to]);
  const running = progress !== null;

  const toggleColumn = (col: ExportColumn) =>
    setColumns((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : EXPORT_COLUMNS.filter((c) => c === col || prev.includes(c))));

  const run = async () => {
    setError(null);
    setProgress({ done: 0, total: rows.length });
    const now = new Date();
    const job = startExport(
      rows,
      { format, columns, meta: { network: NETWORK, generatedAt: now.toISOString() } },
      (done, total) => setProgress({ done, total }),
    );
    jobRef.current = job;
    try {
      const blob = await job.promise;
      if (blob) downloadBlob(applyFilenameTemplate(template, format, now, NETWORK), blob);
    } catch (e) {
      secureLogger.error("Intent export failed", e);
      setError(t("export.error"));
    } finally {
      jobRef.current = null;
      setProgress(null);
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={`${id}-panel`}
        disabled={items.length === 0}
        className="px-3 py-2 rounded-lg border border-vx-border text-xs font-semibold text-vx-muted hover:text-vx-text hover:border-vx-sage/40 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
      >
        {t("export.open")}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={`${id}-panel`}
          role="dialog"
          aria-label={t("export.title")}
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-vx-border bg-vx-card p-4 shadow-xl z-50 space-y-4 text-xs text-vx-muted"
        >
          <fieldset>
            <legend className="font-medium mb-1">{t("export.format")}</legend>
            <div className="flex gap-4">
              {(["csv", "json"] as const).map((f) => (
                <label key={f} className="flex items-center gap-1.5 uppercase">
                  <input type="radio" name={`${id}-format`} checked={format === f} onChange={() => setFormat(f)} />
                  {f}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-medium mb-1">{t("export.columns")}</legend>
            <div className="grid grid-cols-2 gap-1">
              {EXPORT_COLUMNS.map((col) => (
                <label key={col} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={columns.includes(col)} onChange={() => toggleColumn(col)} />
                  {col}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              {t("export.from")}
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-vx-surface border border-vx-border rounded-md px-2 py-1 text-vx-text" />
            </label>
            <label className="flex flex-col gap-1">
              {t("export.to")}
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-vx-surface border border-vx-border rounded-md px-2 py-1 text-vx-text" />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            {t("export.filename")}
            <input value={template} onChange={(e) => setTemplate(e.target.value)} className="bg-vx-surface border border-vx-border rounded-md px-2 py-1 text-vx-text" />
          </label>

          <p>{t("export.estimate", { count: String(rows.length) })}</p>
          <p className="text-vx-dim">{t("export.loadedOnly")}</p>

          {running && (
            <progress
              className="w-full"
              max={progress.total || 1}
              value={progress.done}
              aria-label={t("export.progress", { done: String(progress.done), total: String(progress.total) })}
            />
          )}
          {error && <p role="alert" className="text-red-300">{error}</p>}

          <div className="flex justify-end gap-2">
            {running ? (
              <button type="button" onClick={() => jobRef.current?.cancel()} className="px-3 py-1.5 rounded-lg border border-vx-border hover:text-vx-text">
                {t("export.cancel")}
              </button>
            ) : (
              <button
                type="button"
                onClick={run}
                disabled={rows.length === 0 || columns.length === 0}
                className="px-3 py-1.5 rounded-lg border border-vx-sage/40 text-vx-sage font-semibold disabled:opacity-50"
              >
                {t("export.start")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
