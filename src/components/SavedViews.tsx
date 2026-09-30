"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import {
  BUILT_IN_VIEWS,
  MAX_VIEW_NAME_LENGTH,
  MAX_VIEWS,
  sanitizeViewParams,
  useViewsStore,
  viewParamsToSearch,
  type ViewParams,
  type ViewScope,
} from "@/store/views";

type SavedViewsProps = {
  scope: ViewScope;
  /** Current URL-state of the page (non-default params only). */
  currentParams: ViewParams;
  /** Applies a (validated) view's params to the page. */
  onApply: (params: ViewParams) => void;
};

const chipClass =
  "px-2.5 py-1 rounded-full border text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage";
const iconBtnClass =
  "px-1.5 py-0.5 rounded text-xs text-vx-muted hover:text-vx-text disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage";

/** Saved + built-in filter views with keyboard-operable rename/delete/reorder (#442). */
export function SavedViews({ scope, currentParams, onApply }: SavedViewsProps) {
  const { t } = useTranslation();
  const { copy } = useCopyToClipboard();
  const allViews = useViewsStore((s) => s.views);
  const { saveView, renameView, deleteView, moveView } = useViewsStore.getState();
  const views = allViews.filter((v) => v.scope === scope);
  const builtIns = BUILT_IN_VIEWS.filter((v) => v.scopes.includes(scope));

  const [draftName, setDraftName] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const currentSearch = viewParamsToSearch(currentParams);
  const isActive = (params: ViewParams) => viewParamsToSearch(params) === currentSearch;

  const apply = (params: ViewParams) => {
    const { params: clean, degraded } = sanitizeViewParams(scope, params);
    setNotice(degraded ? t("views.notice.degraded") : null);
    onApply(clean);
  };

  const share = async (params: ViewParams) => {
    const { params: clean } = sanitizeViewParams(scope, params);
    const url = `${window.location.origin}${window.location.pathname}${viewParamsToSearch(clean)}`;
    const ok = await copy(url);
    setNotice(ok ? t("views.notice.linkCopied") : t("views.notice.copyFailed"));
  };

  const submitSave = () => {
    if (draftName === null) return;
    const id = saveView(scope, draftName, currentParams);
    setNotice(id ? t("views.notice.saved") : t("views.notice.saveFailed", { max: MAX_VIEWS }));
    if (id) setDraftName(null);
  };

  const submitRename = () => {
    if (editingId) renameView(editingId, editName);
    setEditingId(null);
  };

  return (
    <section aria-label={t("views.title")} className="mb-6 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">{t("views.title")}</span>
        {builtIns.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={isActive(v.params)}
            onClick={() => apply(v.params)}
            className={`${chipClass} ${isActive(v.params) ? "border-vx-sage text-vx-text" : "border-vx-border text-vx-muted hover:text-vx-text"}`}
          >
            {t(v.nameKey)}
          </button>
        ))}
        {draftName === null ? (
          <button
            type="button"
            onClick={() => setDraftName("")}
            disabled={allViews.length >= MAX_VIEWS}
            className={`${chipClass} border-vx-sage/40 text-vx-sage disabled:opacity-40`}
          >
            {t("views.save")}
          </button>
        ) : (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              submitSave();
            }}
          >
            <label className="sr-only" htmlFor={`view-name-${scope}`}>
              {t("views.nameLabel")}
            </label>
            <input
              id={`view-name-${scope}`}
              autoFocus
              value={draftName}
              maxLength={MAX_VIEW_NAME_LENGTH}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setDraftName(null)}
              placeholder={t("views.nameLabel")}
              className="bg-vx-surface border border-vx-border rounded-lg px-2 py-1 text-xs text-vx-text focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
            />
            <button type="submit" className={iconBtnClass}>
              {t("views.confirm")}
            </button>
            <button type="button" onClick={() => setDraftName(null)} className={iconBtnClass}>
              {t("views.cancel")}
            </button>
          </form>
        )}
      </div>

      {views.length > 0 && (
        <ul aria-label={t("views.savedList")} className="flex flex-wrap gap-2">
          {views.map((v, i) => (
            <li key={v.id} className="flex items-center gap-0.5 rounded-full border border-vx-border pl-1 pr-1.5">
              {editingId === v.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitRename();
                  }}
                >
                  <label className="sr-only" htmlFor={`rename-${v.id}`}>
                    {t("views.rename")}
                  </label>
                  <input
                    id={`rename-${v.id}`}
                    autoFocus
                    value={editName}
                    maxLength={MAX_VIEW_NAME_LENGTH}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={submitRename}
                    onKeyDown={(e) => e.key === "Escape" && setEditingId(null)}
                    className="bg-vx-surface rounded px-1.5 py-0.5 text-xs text-vx-text focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
                  />
                </form>
              ) : (
                <button
                  type="button"
                  aria-pressed={isActive(v.params)}
                  onClick={() => apply(v.params)}
                  className={`${chipClass} border-transparent ${isActive(v.params) ? "text-vx-text" : "text-vx-muted hover:text-vx-text"}`}
                >
                  {/* Rendered as text: names are sanitised and never parsed as HTML. */}
                  <bdi>{v.name}</bdi>
                </button>
              )}
              <button type="button" className={iconBtnClass} disabled={i === 0} onClick={() => moveView(v.id, -1)} aria-label={t("views.moveUp", { name: v.name })}>
                ↑
              </button>
              <button type="button" className={iconBtnClass} disabled={i === views.length - 1} onClick={() => moveView(v.id, 1)} aria-label={t("views.moveDown", { name: v.name })}>
                ↓
              </button>
              <button
                type="button"
                className={iconBtnClass}
                onClick={() => {
                  setEditingId(v.id);
                  setEditName(v.name);
                }}
                aria-label={t("views.renameNamed", { name: v.name })}
              >
                ✎
              </button>
              <button type="button" className={iconBtnClass} onClick={() => void share(v.params)} aria-label={t("views.share", { name: v.name })}>
                ⧉
              </button>
              <button type="button" className={iconBtnClass} onClick={() => deleteView(v.id)} aria-label={t("views.delete", { name: v.name })}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <p role="status" aria-live="polite" className="text-xs text-vx-muted min-h-[1rem]">
        {notice}
      </p>
    </section>
  );
}
