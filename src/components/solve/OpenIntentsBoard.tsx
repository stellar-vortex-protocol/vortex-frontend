"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { SkeletonCard } from "@/components/Skeleton";
import { useOpenIntentBoard } from "@/hooks/useOpenIntentBoard";
import { useAcceptIntent } from "@/hooks/useAcceptIntent";
import { useSolvers } from "@/hooks/useSolvers";
import { useNow } from "@/hooks/useNow";
import { useQueryState } from "@/hooks/useQueryState";
import { useWalletStore } from "@/store/wallet";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { formatTimeRemaining, secondsRemaining, URGENT_THRESHOLD_SECONDS } from "@/lib/time";
import { intentUsdValue, rowReducer, type RowEntry } from "@/lib/openIntentBoard";
import type { OpenIntent } from "@/lib/types";

const TAKEN_ROW_LINGER_MS = 3_000;

export function OpenIntentsBoard() {
  const { t } = useTranslation();
  const { params, update } = useQueryState();

  const minUsdParam = Number(params.get("minUsd"));
  const filters = {
    chain: params.get("ichain") || "all",
    token: params.get("itoken") || "all",
    minUsd: Number.isFinite(minUsdParam) && minUsdParam > 0 ? minUsdParam : 0,
  };
  const compact = params.get("density") === "compact";

  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const { intents, all, pendingCount, flush, isLoading, error, isLive, clockOffsetMs } =
    useOpenIntentBoard(filters, hovered || focused);

  const { accept } = useAcceptIntent();
  const { solvers } = useSolvers();
  const walletAddress = useWalletStore((s) => s.address);
  const isConnected = useWalletStore((s) => s.isConnected);
  const networkMismatch = useWalletStore((s) => s.networkMismatch);
  const notRegistered =
    isConnected && !!walletAddress && solvers.length > 0 && !solvers.some((s) => s.address === walletAddress);
  const acceptBlocked = networkMismatch || notRegistered;

  const [rows, dispatch] = useReducer(rowReducer, {});
  const [announcement, setAnnouncement] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const now = useNow() + clockOffsetMs;

  const handleAccept = useCallback(
    async (intent: OpenIntent) => {
      dispatch({ type: "start", intent });
      const outcome = await accept(intent.id);
      dispatch({ type: "settle", id: intent.id, outcome });
      if (outcome === "taken") {
        setAnnouncement(t("solve.intents.announce.taken", { id: intent.id }));
        timers.current.push(setTimeout(() => dispatch({ type: "remove", id: intent.id }), TAKEN_ROW_LINGER_MS));
      } else if (outcome === "expired") {
        setAnnouncement(t("solve.intents.announce.expired", { id: intent.id }));
      } else if (outcome === "accepted") {
        setAnnouncement(t("solve.intents.announce.accepted", { id: intent.id }));
      }
    },
    [accept, t],
  );

  // Keep accepted/taken rows visible after the relay drops them from the feed.
  const displayed = useMemo(() => {
    const ids = new Set(intents.map((i) => i.id));
    const extra = Object.values(rows)
      .filter((r: RowEntry) => !ids.has(r.intent.id) && (r.status === "accepted" || r.status === "taken"))
      .map((r) => r.intent);
    return [...extra, ...intents];
  }, [intents, rows]);

  const chains = useMemo(() => Array.from(new Set(all.map((i) => i.srcChain))).sort(), [all]);
  const tokens = useMemo(() => Array.from(new Set(all.map((i) => i.srcToken))).sort(), [all]);

  const control =
    "bg-vx-surface border border-vx-border rounded-md px-2 py-1.5 text-xs text-vx-text focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage";

  return (
    <div className="card overflow-hidden">
      <div className="px-3 sm:px-5 py-3 border-b border-vx-border bg-vx-surface/30 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-vx-text">{t("solve.intents.title")}</h2>
          <span className="chip bg-vx-sage-bg text-vx-sage text-[10px]">
            {isLive && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-vx-sage animate-pulse" />}
            {t("solve.intents.available", { count: intents.length })}
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[10px] text-vx-muted">
            {t("solve.intents.filter.chain")}
            <select className={control} value={filters.chain} onChange={(e) => update({ ichain: e.target.value === "all" ? null : e.target.value })}>
              <option value="all">{t("solve.leaderboard.filter.all")}</option>
              {chains.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-vx-muted">
            {t("solve.intents.filter.token")}
            <select className={control} value={filters.token} onChange={(e) => update({ itoken: e.target.value === "all" ? null : e.target.value })}>
              <option value="all">{t("solve.leaderboard.filter.all")}</option>
              {tokens.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-vx-muted">
            {t("solve.intents.filter.minUsd")}
            <input
              type="number"
              min={0}
              inputMode="decimal"
              className={`${control} w-24`}
              value={filters.minUsd || ""}
              onChange={(e) => update({ minUsd: e.target.value && Number(e.target.value) > 0 ? e.target.value : null })}
            />
          </label>
          <button
            type="button"
            aria-pressed={compact}
            onClick={() => update({ density: compact ? null : "compact" })}
            className={`${control} ml-auto`}
          >
            {compact ? t("solve.intents.density.detailed") : t("solve.intents.density.compact")}
          </button>
        </div>
      </div>

      <div role="status" aria-live="polite" className="sr-only">{announcement}</div>

      {networkMismatch && (
        <p role="alert" className="px-5 py-2.5 text-xs text-vx-amber border-b border-vx-line">{t("solve.intents.networkMismatch")}</p>
      )}
      {notRegistered && (
        <p role="alert" className="px-5 py-2.5 text-xs text-vx-amber border-b border-vx-line">{t("solve.intents.notRegistered")}</p>
      )}
      {pendingCount > 0 && (
        <button type="button" onClick={flush} className="w-full px-5 py-2 text-xs text-vx-sage bg-vx-sage-bg/50 border-b border-vx-line hover:bg-vx-sage-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vx-sage">
          {t("solve.intents.pendingUpdates", { count: pendingCount })}
        </button>
      )}

      {isLoading && all.length === 0 ? (
        <div className="p-5"><SkeletonCard rows={3} rowHeight="h-16" /></div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-vx-muted">{t("solve.intents.error")}</div>
      ) : displayed.length === 0 ? (
        <div className="p-8 text-center text-sm text-vx-muted">{t("solve.intents.empty")}</div>
      ) : (
        <ul
          className="divide-y divide-vx-line"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}
        >
          {displayed.map((intent) => {
            const row = rows[intent.id];
            const secs = secondsRemaining(intent.deadline, now);
            const expired = secs <= 0 || row?.status === "expired";
            const urgent = !expired && secs < URGENT_THRESHOLD_SECONDS;
            const usd = intentUsdValue(intent);
            const status = row?.status;
            return (
              <li
                key={intent.id}
                className={`px-3 sm:px-5 ${compact ? "py-2" : "py-4"} flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  status === "taken" ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  {!compact && <div className="num text-xs text-vx-muted mb-1">{t("solve.intents.id", { id: intent.id })}</div>}
                  <div className="text-sm font-medium text-vx-text">
                    {t("solve.intents.summary", { amount: intent.srcAmount, token: intent.srcToken, chain: intent.srcChain })}
                  </div>
                  {!compact && (
                    <div className="text-xs text-vx-muted">
                      {t("solve.intents.minOut", { minOut: intent.minOut, dstToken: intent.dstToken })}
                      {usd !== null ? ` · ≈ $${usd.toLocaleString()}` : ""}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span
                    className={`num text-xs tabular-nums ${expired ? "text-vx-muted" : urgent ? "text-red-400 font-semibold" : "text-vx-text"}`}
                    aria-label={expired ? t("solve.intents.expired") : t("solve.intents.timeLeft", { time: formatTimeRemaining(intent.deadline, now) })}
                  >
                    {expired ? t("solve.intents.expired") : formatTimeRemaining(intent.deadline, now)}
                    {urgent && <span className="ml-1 text-[10px] uppercase">{t("solve.intents.urgent")}</span>}
                  </span>

                  {status === "accepted" ? (
                    <span className="text-xs font-semibold text-vx-sage">{t("solve.intents.acceptedByYou")}</span>
                  ) : status === "taken" ? (
                    <span className="text-xs text-vx-muted">{t("solve.intents.taken")}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAccept(intent)}
                      disabled={expired || status === "pending" || acceptBlocked}
                      aria-busy={status === "pending"}
                      aria-describedby={expired ? `expired-${intent.id}` : undefined}
                      className="px-3 sm:px-4 py-2 bg-vx-sage-bg text-vx-sage text-xs font-semibold rounded-lg border border-vx-sage/30 hover:bg-vx-sage/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
                    >
                      {status === "pending" ? t("solve.intents.accepting") : t("solve.intents.accept")}
                    </button>
                  )}
                </div>
                {expired && status !== "accepted" && (
                  <p id={`expired-${intent.id}`} className="text-[11px] text-vx-muted sm:hidden">{t("solve.intents.expiredHelp")}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
