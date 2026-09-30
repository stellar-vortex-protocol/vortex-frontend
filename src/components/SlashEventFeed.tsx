"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { groupEventsByDay, reasonInfo, type SlashEvent } from "@/lib/slashEvents";

type SlashEventFeedProps = {
  events: SlashEvent[];
  isLoading?: boolean;
  error?: unknown;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  /** Hide the solver column when the feed is already scoped to one solver. */
  showSolver?: boolean;
};

const FOCUS_RING = "focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage";

export function ReasonChip({ code }: { code: string }) {
  const { t } = useTranslation();
  const info = reasonInfo(code);
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded border border-vx-border bg-vx-surface text-vx-text"
      title={info.known ? undefined : code}
    >
      {t(info.label)}
      {!info.known && <span className="num text-vx-muted ml-1">({code})</span>}
    </span>
  );
}

function EventDrawer({ event, onClose }: { event: SlashEvent; onClose: () => void }) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const info = reasonInfo(event.reasonCode);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="slash-drawer-title"
        className="card w-full max-w-sm h-full overflow-y-auto p-5 space-y-4 rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="slash-drawer-title" className="text-base font-semibold text-vx-text">
            {t("slash.drawer.title")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={`text-xs text-vx-muted hover:text-vx-text rounded px-2 py-1 ${FOCUS_RING}`}
          >
            {t("slash.drawer.close")}
          </button>
        </div>
        <ReasonChip code={event.reasonCode} />
        <p className="text-sm text-vx-text">{t(info.explanation)}</p>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <dt className="text-vx-muted">{t("slash.field.amount")}</dt>
          <dd className="num text-vx-text">${event.amountUsd}</dd>
          <dt className="text-vx-muted">{t("slash.field.resultingBond")}</dt>
          <dd className="num text-vx-text">${event.resultingBondUsd}</dd>
          <dt className="text-vx-muted">{t("slash.field.intent")}</dt>
          <dd>
            {event.intentId ? (
              <Link href={`/explore/${encodeURIComponent(event.intentId)}`} className={`text-vx-sage hover:underline ${FOCUS_RING}`}>
                {event.intentId}
              </Link>
            ) : (
              <span className="text-vx-muted">{t("slash.field.noIntent")}</span>
            )}
          </dd>
          <dt className="text-vx-muted">{t("slash.field.time")}</dt>
          <dd className="num text-vx-text">
            <time dateTime={event.createdAt}>{new Date(event.createdAt).toUTCString()}</time>
          </dd>
        </dl>
        <div>
          <h3 className="eyebrow text-xs mb-1">{t("slash.drawer.remediation")}</h3>
          <p className="text-xs text-vx-muted">{t(info.remediation)}</p>
        </div>
      </div>
    </div>
  );
}

export function SlashEventFeed({
  events,
  isLoading,
  error,
  hasMore,
  isLoadingMore,
  onLoadMore,
  showSolver = true,
}: SlashEventFeedProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<SlashEvent | null>(null);
  const closeDrawer = useCallback(() => setSelected(null), []);
  const groups = groupEventsByDay(events);

  return (
    <section className="card overflow-hidden" aria-labelledby="slash-feed-title">
      <div className="px-4 sm:px-5 py-3 border-b border-vx-border bg-vx-surface/30">
        <h2 id="slash-feed-title" className="text-sm font-semibold text-vx-text">
          {t("slash.feed.title")}
        </h2>
      </div>

      {isLoading && events.length === 0 ? (
        <div className="p-5 space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-12 bg-vx-surface/40 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p role="alert" className="p-6 text-center text-sm text-vx-muted">
          {t("slash.feed.error")}
        </p>
      ) : events.length === 0 ? (
        <p role="status" className="p-6 text-center text-sm text-vx-muted">
          {t("slash.feed.empty")}
        </p>
      ) : (
        <div className="divide-y divide-vx-line">
          {groups.map(({ day, events: dayEvents }) => (
            <div key={day}>
              <h3 className="px-4 sm:px-5 pt-3 eyebrow text-[10px] num">{day}</h3>
              <ul className="px-2 sm:px-3 pb-2">
                {dayEvents.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(e)}
                      className={`w-full text-left px-2 py-2 rounded-lg hover:bg-vx-surface/30 flex flex-wrap items-center gap-2 ${FOCUS_RING}`}
                    >
                      <ReasonChip code={e.reasonCode} />
                      <span className="num text-xs text-vx-text">-${e.amountUsd}</span>
                      {showSolver && (
                        <span className="num text-[10px] text-vx-muted truncate max-w-[10rem]">{e.solver}</span>
                      )}
                      <time dateTime={e.createdAt} className="num text-[10px] text-vx-muted ml-auto">
                        {new Date(e.createdAt).toISOString().slice(11, 16)} UTC
                      </time>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {hasMore && (
            <div className="p-3 text-center">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className={`text-xs text-vx-sage hover:underline rounded px-2 py-1 disabled:opacity-50 ${FOCUS_RING}`}
              >
                {isLoadingMore ? t("slash.feed.loading") : t("slash.feed.loadMore")}
              </button>
            </div>
          )}
        </div>
      )}

      <details className="border-t border-vx-border px-4 sm:px-5 py-3">
        <summary className={`text-xs font-semibold text-vx-text cursor-pointer rounded ${FOCUS_RING}`}>
          {t("slash.explainer.title")}
        </summary>
        <p className="text-xs text-vx-muted mt-2">{t("slash.explainer.body")}</p>
        <Link href="/governance" className={`text-xs text-vx-sage hover:underline rounded ${FOCUS_RING}`}>
          {t("slash.explainer.link")}
        </Link>
      </details>

      {selected && <EventDrawer event={selected} onClose={closeDrawer} />}
    </section>
  );
}
