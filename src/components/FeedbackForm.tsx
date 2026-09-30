"use client";

import { useId, useState } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import {
  buildFeatureRequestUrl,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
} from "@/lib/featureRequest";

/**
 * Lightweight "Suggest a feature" intake: the form opens GitHub's new-issue
 * page pre-filled from the user's input (see `src/lib/featureRequest.ts`),
 * so suggestions land in the same issue-driven process as everything else.
 */
export function FeedbackForm() {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError(t("feedback.required"));
      return;
    }
    setError(null);
    window.open(buildFeatureRequestUrl({ title, description }), "_blank", "noopener,noreferrer");
    setOpen(false);
    setTitle("");
    setDescription("");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="hover:text-vx-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage rounded"
      >
        {t("feedback.open")}
      </button>

      {open && (
        <form
          id={`${id}-panel`}
          aria-label={t("feedback.title")}
          onSubmit={handleSubmit}
          noValidate
          className="absolute bottom-full right-0 mb-2 w-72 sm:w-80 rounded-xl border border-vx-border bg-vx-card p-4 shadow-xl z-40 space-y-3 text-left"
        >
          <p className="text-sm font-semibold text-vx-text">{t("feedback.title")}</p>
          <div>
            <label htmlFor={`${id}-title`} className="block text-xs text-vx-muted mb-1">
              {t("feedback.titleLabel")}
            </label>
            <input
              id={`${id}-title`}
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-vx-surface border border-vx-border rounded-md px-2 py-1.5 text-sm text-vx-text focus:outline-none focus:border-vx-sage/50"
            />
          </div>
          <div>
            <label htmlFor={`${id}-description`} className="block text-xs text-vx-muted mb-1">
              {t("feedback.descriptionLabel")}
            </label>
            <textarea
              id={`${id}-description`}
              value={description}
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={4}
              onChange={(e) => setDescription(e.target.value)}
              aria-describedby={`${id}-count`}
              className="w-full bg-vx-surface border border-vx-border rounded-md px-2 py-1.5 text-sm text-vx-text focus:outline-none focus:border-vx-sage/50"
            />
            <p id={`${id}-count`} className="text-[10px] text-vx-dim text-right">
              {t("feedback.count", { current: description.length, max: MAX_DESCRIPTION_LENGTH })}
            </p>
          </div>
          <p className="text-[11px] text-vx-muted">{t("feedback.githubNote")}</p>
          {error && (
            <p role="alert" className="text-[11px] text-red-400">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-vx-border text-xs text-vx-muted hover:text-vx-text focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
            >
              {t("feedback.cancel")}
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg border border-vx-sage/40 bg-vx-sage-bg text-xs font-semibold text-vx-sage hover:bg-vx-sage/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
            >
              {t("feedback.submit")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
