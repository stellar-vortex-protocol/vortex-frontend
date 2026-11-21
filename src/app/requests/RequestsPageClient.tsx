"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  getSupportRequests,
  submitSupportRequest,
  upvoteSupportRequest,
  isAlreadySupported,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  JUSTIFICATION_MIN_LENGTH,
  JUSTIFICATION_MAX_LENGTH,
  type SupportRequest,
  type SupportRequestKind,
  type SubmitError,
} from "@/lib/supportRequestStore";

export type RequestSort = "upvotes" | "newest" | "name";

const SORT_OPTIONS: RequestSort[] = ["upvotes", "newest", "name"];

function compareRequests(a: SupportRequest, b: SupportRequest, sort: RequestSort): number {
  if (sort === "upvotes") {
    const diff = b.upvoters.length - a.upvoters.length;
    if (diff !== 0) return diff;
  } else if (sort === "newest") {
    const diff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (diff !== 0) return diff;
  } else {
    const diff = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    if (diff !== 0) return diff;
  }
  // Stable tie-breaker: newest first, then id.
  const created = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  if (created !== 0) return created;
  return a.id.localeCompare(b.id);
}

export function sortRequests(requests: SupportRequest[], sort: RequestSort): SupportRequest[] {
  return [...requests].sort((a, b) => compareRequests(a, b, sort));
}

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; error: SubmitError; existingId?: string }
  | { status: "success" };

export default function RequestsPageClient() {
  const { t } = useI18n();
  const { address } = useWallet();

  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [kind, setKind] = useState<SupportRequestKind>("chain");
  const [name, setName] = useState("");
  const [justification, setJustification] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [upvoteError, setUpvoteError] = useState<string | null>(null);

  const debouncedName = useDebouncedValue(name, 300);

  const refresh = useCallback(() => {
    setRequests(getSupportRequests());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const alreadySupported = useMemo(
    () => (name.trim() ? isAlreadySupported(kind, name) : false),
    [kind, name],
  );

  const liveAlreadySupported = useMemo(
    () => (debouncedName.trim() ? isAlreadySupported(kind, debouncedName) : false),
    [kind, debouncedName],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!address) return;
      const result = submitSupportRequest(address, { kind, name, justification });
      if (result.ok) {
        setSubmitState({ status: "success" });
        setName("");
        setJustification("");
        refresh();
        return;
      }
      setSubmitState({ status: "error", error: result.error, existingId: result.existingId });
    },
    [address, kind, name, justification, refresh],
  );

  const handleUpvote = useCallback(
    (id: string) => {
      if (!address) return;
      setUpvoteError(null);
      const result = upvoteSupportRequest(id, address);
      if (!result.ok) {
        setUpvoteError(t(`requests.upvoteError.${result.error}`));
        return;
      }
      refresh();
    },
    [address, refresh, t],
  );

  const handleDuplicateUpvote = useCallback(() => {
    if (submitState.status !== "error" || !submitState.existingId) return;
    handleUpvote(submitState.existingId);
    setSubmitState({ status: "idle" });
  }, [submitState, handleUpvote]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t("requests.title")}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t("requests.subtitle")}</p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="request-kind" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("requests.form.kind")}
          </label>
          <select
            id="request-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as SupportRequestKind)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="chain">{t("requests.form.kindChain")}</option>
            <option value="token">{t("requests.form.kindToken")}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="request-name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("requests.form.name")}
          </label>
          <input
            id="request-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={NAME_MIN_LENGTH}
            maxLength={NAME_MAX_LENGTH}
            required
            aria-describedby={liveAlreadySupported ? "request-name-hint" : undefined}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          {liveAlreadySupported && (
            <p
              id="request-name-hint"
              role="status"
              className="text-sm text-amber-700 dark:text-amber-400"
            >
              {t("requests.form.alreadySupportedHint")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="request-justification" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("requests.form.justification")}
          </label>
          <textarea
            id="request-justification"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            minLength={JUSTIFICATION_MIN_LENGTH}
            maxLength={JUSTIFICATION_MAX_LENGTH}
            rows={4}
            required
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {alreadySupported && (
          <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
            {t("requests.error.already-supported")}
          </p>
        )}

        {submitState.status === "error" && (
          <div role="alert" className="flex flex-col gap-2 text-sm text-red-700 dark:text-red-400">
            <p>{t(`requests.error.${submitState.error}`)}</p>
            {submitState.error === "duplicate" && submitState.existingId && (
              <button
                type="button"
                onClick={handleDuplicateUpvote}
                className="self-start rounded-md border border-indigo-500 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-400 dark:text-indigo-300 dark:hover:bg-indigo-950"
              >
                {t("requests.error.duplicateUpvote")}
              </button>
            )}
          </div>
        )}

        {submitState.status === "success" && (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {t("requests.form.success")}
          </p>
        )}

        <button
          type="submit"
          disabled={!address || alreadySupported}
          className="self-start rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("requests.form.submit")}
        </button>
      </form>

      {upvoteError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {upvoteError}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {requests.map((request) => (
          <li
            key={request.id}
            className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {request.name}
              </span>
              <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t(`requests.form.kind${request.kind === "chain" ? "Chain" : "Token"}`)}
              </span>
              <p className="text-sm text-slate-600 dark:text-slate-400">{request.justification}</p>
            </div>
            <button
              type="button"
              onClick={() => handleUpvote(request.id)}
              disabled={!address}
              className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t("requests.upvote")} ({request.upvotes.length})
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
