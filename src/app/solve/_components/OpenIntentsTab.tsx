"use client";

import { SkeletonCard } from "@/components/Skeleton";
import { useOpenIntents } from "@/hooks/useOpenIntents";
import { useAcceptIntent } from "@/hooks/useAcceptIntent";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { DeadlineChip } from "./DeadlineChip";

export function OpenIntentsTab() {
  const { t } = useTranslation();
  const { intents, isLoading, error } = useOpenIntents();
  const { accept, acceptingId, error: acceptError } = useAcceptIntent();

  return (
    <div className="space-y-4">
      <div className="px-5 py-3.5 border-b border-vx-border bg-vx-surface/30 flex items-center justify-between">
        <span className="text-sm font-semibold text-vx-text">{t("solve.intents.title")}</span>
        <span className="chip bg-vx-sage-bg text-vx-sage text-[10px]">
          <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-vx-sage animate-pulse" />
          {t("solve.intents.available", { count: intents.length })}
        </span>
      </div>

      {acceptError && (
        <div role="alert" className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
          {acceptError}
        </div>
      )}

      {isLoading && intents.length === 0 ? (
        <SkeletonCard rows={3} rowHeight="h-16" />
      ) : error ? (
        <div className="p-8 text-center text-sm text-vx-muted">{t("solve.intents.error")}</div>
      ) : intents.length === 0 ? (
        <div className="p-8 text-center text-sm text-vx-muted">{t("solve.intents.empty")}</div>
      ) : (
        <div className="space-y-2">
          {intents.map((intent) => (
            <div key={intent.id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="num text-xs text-vx-muted mb-1">{t("solve.intents.id", { id: intent.id })}</div>
                <div className="text-sm font-medium text-vx-text capitalize">
                  {intent.srcAmount} {intent.srcToken} on {intent.srcChain}
                </div>
                <div className="text-xs text-vx-muted">
                  {t("solve.intents.minOut", { minOut: intent.minOut, dstToken: intent.dstToken })}{" "}
                  <DeadlineChip deadline={intent.deadline} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => accept(intent.id)}
                disabled={acceptingId === intent.id}
                aria-busy={acceptingId === intent.id}
                className="px-3 sm:px-4 py-2 bg-vx-sage-bg text-vx-sage text-xs font-semibold rounded-lg border border-vx-sage/30 hover:bg-vx-sage/15 transition-colors flex-shrink-0 w-full sm:w-auto disabled:opacity-60 disabled:cursor-wait"
              >
                {acceptingId === intent.id ? t("solve.intents.accepting") : t("solve.intents.accept")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
