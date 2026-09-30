"use client";

import { EmptyState } from "@/components/EmptyState";
import { CopyButton } from "@/components/CopyButton";
import { CLIENT_ERROR_MESSAGE_KEYS, toClientError } from "@/lib/api";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";

/** Shared, localised error state for any failed data fetch. */
export function ErrorState({
  error,
  retry,
  title,
}: {
  error: unknown;
  retry?: () => void;
  title?: string;
}) {
  const { t } = useTranslation();
  const e = toClientError(error);
  return (
    <EmptyState
      variant="error"
      title={title ?? t("error.title")}
      message={t(CLIENT_ERROR_MESSAGE_KEYS[e.kind] as MessageKey)}
      action={
        <div className="flex flex-col items-center gap-2">
          {retry && (
            <button type="button" className="btn-secondary" onClick={retry}>
              {t("error.retry")}
            </button>
          )}
          {e.requestId && (
            <p className="flex items-center gap-1 text-xs text-vx-muted">
              <span>{t("error.requestId", { id: e.requestId })}</span>
              <CopyButton value={e.requestId} label={t("error.requestId", { id: e.requestId })} />
            </p>
          )}
        </div>
      }
    />
  );
}
