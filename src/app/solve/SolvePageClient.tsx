"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SolverLeaderboard } from "@/components/solve/SolverLeaderboard";
import { OpenIntentsBoard } from "@/components/solve/OpenIntentsBoard";
import { RegistrationWizard } from "@/components/solve/RegistrationWizard";
import { SkeletonCard } from "@/components/Skeleton";
import { useQueryState } from "@/hooks/useQueryState";
import { useSolvers } from "@/hooks/useSolvers";
import { useOpenIntents } from "@/hooks/useOpenIntents";
import { useAcceptIntent } from "@/hooks/useAcceptIntent";
import { useSolverRegistration } from "@/hooks/useSolverRegistration";
import { useLocalStorageDraft } from "@/hooks/useLocalStorageDraft";
import { useWalletStore } from "@/store/wallet";
import { timeRemaining } from "@/lib/time";
import { isValidStellarPublicKey } from "@/lib/stellarAddress";
import { useTranslation, useLocale } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import { formatCurrency, formatUsdCompact, localeToBcp47 } from "@/lib/format";
import { sanitizeDisplayText } from "@/lib/textSafety";
import Link from "next/link";

const TABS = ["leaderboard", "intents", "register"] as const;
type Tab = (typeof TABS)[number];

const ONBOARDING_DISMISSED_KEY = "vortex_solver_onboarding_dismissed";
const STEP_IDS = ["registerBond", "watchIntentFeed", "fillAndEarn"] as const;
const ONBOARDING_SECTIONS = ["bond", "metrics", "expectations"] as const;

/** Shape of the persisted registration draft. */
type RegistrationDraft = {
  address: string;
  bond: string;
};


function formatTimeRemaining(deadlineStr: string): string {
  const ms = new Date(deadlineStr).getTime() - Date.now();
  if (ms <= 0) return "0m";
  const mins = Math.ceil(ms / 60_000);
  return `${mins}m`;
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}
}

export default function SolvePageClient() {
  const { t } = useTranslation();
  const locale = useLocale();
  const bcp47 = localeToBcp47(locale);
  const { params, update } = useQueryState();
  const tabParam = params.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as Tab)
    : "leaderboard";

  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(() =>
    typeof window !== "undefined" ? readDismissed() : false,
  );
  const { solvers, isLoading: solversLoading, error: solversError } = useSolvers();
  const { intents: openIntents, isLoading: intentsLoading, error: intentsError } = useOpenIntents();
  const { accept, acceptingId, error: acceptError } = useAcceptIntent();
  const { register, status: regStatus, error: regError, reset } =
    useSolverRegistration();

  // Draft persistence — scoped to the currently connected wallet so that
  // switching wallets never silently restores the wrong address.
  const connectedAddress = useWalletStore((s) => s.address);

  // Derive whether the connected wallet is already a registered solver.
  // Compare case-insensitively as a defensive measure — Stellar addresses
  // are uppercase-only by spec, but normalise both sides to be safe.
  const connectedSolver = solvers.find(
    (s) =>
      connectedAddress &&
      s.address.toLowerCase() === connectedAddress.toLowerCase(),
  ) ?? null;
  const [draft, setDraft, clearDraft] = useLocalStorageDraft<RegistrationDraft>(
    "vortex:solver-registration-draft",
    connectedAddress ?? null,
  );

  const toggleOnboarding = () => {
    const next = !onboardingDismissed;
    setOnboardingDismissed(next);
    try {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, String(next));
    } catch {
      // Preference just won't persist.
    }
  };

  // Each tab keeps its own query params; switching tabs drops the others'.
  const selectTab = (next: Tab) => {
    if (next === tab) return;
    const keep = new URLSearchParams();
    if (next !== "leaderboard") keep.set("tab", next);

  );
  const toggleOnboarding = () => {
    const next = !onboardingDismissed;
    setOnboardingDismissed(next);
    try {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, String(next));
    } catch {
      // Preference just won't persist.
    }
  };

  // Each tab keeps its own query params; switching tabs drops the others'.
  const selectTab = (next: Tab) => {
    if (next === tab) return;
    const keep = new URLSearchParams();
    if (next !== "leaderboard") keep.set("tab", next);
    const updates: Record<string, string | null> = {};
    params.forEach((_, key) => { updates[key] = null; });
    keep.forEach((value, key) => { updates[key] = value; });
    update(updates);
  };

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={t("solve.nav.label")} />

      <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-5 py-8 sm:py-12">
        <div className="mb-8 sm:mb-10">
          <div className="eyebrow mb-3">{t("solve.hero.eyebrow")}</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-vx-text mb-3">{t("solve.hero.title")}</h1>
          <p className="text-vx-muted text-sm max-w-lg leading-relaxed">{t("solve.hero.description")}</p>
        </div>

        {/* ── Registered-solver banner ─────────────────────────────────── */}
        {connectedSolver && (
          <div
            role="status"
            aria-label="You are a registered solver"
            className="mb-8 flex items-center justify-between gap-3 rounded-xl border border-vx-sage/30 bg-vx-sage-bg px-4 py-3"
          >
            <div className="flex items-center gap-2 text-xs text-vx-sage">
              <span className="w-2 h-2 rounded-full bg-vx-sage flex-shrink-0" aria-hidden="true" />
              <span>
                You&apos;re a registered solver —{" "}
                <strong>{sanitizeDisplayText(connectedSolver.name)}</strong>
              </span>
            </div>
            <Link
              href={`/solve/${connectedSolver.address}`}
              className="text-xs font-semibold text-vx-sage hover:underline whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage rounded"
            >
              View your profile →
            </Link>
          </div>
        )}

        {/* Steps strip */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8 sm:mb-10">
          {STEP_IDS.map((id) => (
            <div key={id} className="card p-4 sm:p-5">
              <div className="font-mono text-xs text-vx-sage mb-2 sm:mb-3">{t(`solve.steps.${id}.number` as MessageKey)}</div>
              <h3 className="text-xs sm:text-sm font-semibold text-vx-text mb-2">{t(`solve.steps.${id}.title` as MessageKey)}</h3>
              <p className="text-xs text-vx-muted leading-relaxed">{t(`solve.steps.${id}.body` as MessageKey)}</p>
            </div>
          ))}
        </div>

        <div role="tablist" aria-label={t("solve.tabs.ariaLabel")} className="flex border-b border-vx-border gap-1 mb-6 sm:mb-8 overflow-x-auto">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              onClick={() => selectTab(id)}
              className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage ${
                tab === id ? "bg-vx-card text-vx-text border border-vx-border" : "text-vx-muted hover:text-vx-text"
              }`}
            >
              {t(`solve.tabs.${id}` as MessageKey)}
            </button>
          ))}
        </div>

        {tab === "leaderboard" && (
          <div
            id="panel-leaderboard"
            role="tabpanel"
            aria-labelledby="tab-leaderboard"
            className="card overflow-hidden"
          >
            <div className="px-3 sm:px-5 py-3 sm:py-3.5 border-b border-vx-border bg-vx-surface/30">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-vx-text">
                  {getMessage("solve.leaderboard.title")}
                </span>
                <div className="hidden sm:flex items-center gap-1" role="group" aria-label="Sort leaderboard">
                  {([
                    ["fills",                "Fills"],
                    ["volumeUsd",            "Volume"],
                    ["avgFillTimeSeconds",   "Avg Time"],
                    ["successRatePct",       "Success %"],
                  ] as [SortKey, string][]).map(([key, label]) => {
                    const isActive = sortKey === key && sortDir !== "none";
                    const ariaSortValue: "ascending" | "descending" | "none" =
                      sortKey === key && sortDir !== "none"
                        ? sortDir === "asc" ? "ascending" : "descending"
                        : "none";
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSort(key)}
                        aria-sort={ariaSortValue}
                        aria-label={`Sort by ${label}${
                          sortKey === key && sortDir !== "none"
                            ? sortDir === "asc" ? ", ascending" : ", descending"
                            : ""
                        }`}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors
                          ${
                            isActive
                              ? "bg-vx-sage-bg text-vx-sage border border-vx-sage/30"
                              : "text-vx-muted hover:text-vx-text border border-transparent hover:border-vx-border"
                          }`}
                      >
                        {label}
                        <SortIcon direction={sortKey === key ? sortDir : "none"} />
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Mobile sort: compact dropdown alternative */}
              <div className="flex sm:hidden items-center gap-1 mt-2 flex-wrap" role="group" aria-label="Sort leaderboard">
                {([
                  ["fills",                "Fills"],
                  ["volumeUsd",            "Volume"],
                  ["avgFillTimeSeconds",   "Avg Time"],
                  ["successRatePct",       "Success %"],
                ] as [SortKey, string][]).map(([key, label]) => {
                  const isActive = sortKey === key && sortDir !== "none";
                  const ariaSortValue: "ascending" | "descending" | "none" =
                    sortKey === key && sortDir !== "none"
                      ? sortDir === "asc" ? "ascending" : "descending"
                      : "none";
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSort(key)}
                      aria-sort={ariaSortValue}
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] transition-colors
                        ${
                          isActive
                            ? "bg-vx-sage-bg text-vx-sage border border-vx-sage/30"
                            : "text-vx-muted hover:text-vx-text border border-transparent hover:border-vx-border"
                        }`}
                    >
                      {label}
                      <SortIcon direction={sortKey === key ? sortDir : "none"} />
                    </button>
                  );
                })}
              </div>
            </div>

            {solversLoading && solvers.length === 0 ? (
              <div className="p-5">
                <SkeletonCard rows={3} rowHeight="h-16" />
              </div>
            ) : solversError ? (
              <div className="p-8 text-center text-sm text-vx-muted">
                {t("solve.leaderboard.error")}
              </div>
            ) : solvers.length === 0 ? (
              <div className="p-8 text-center text-sm text-vx-muted">
                {t("solve.leaderboard.empty")}
              </div>
            ) : (
              <div className="divide-y divide-vx-line">
                {sortedSolvers.map((s, i) => (
                  <Link
                    key={s.address}
                    href={`/solve/${s.address}`}
                    className="block px-3 sm:px-5 py-4 hover:bg-vx-surface/30 transition-colors"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="num text-base sm:text-lg font-bold text-vx-dim flex-shrink-0">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-vx-text truncate">{sanitizeDisplayText(s.name)}</div>
                          <div className="num text-xs text-vx-muted truncate">{s.address}</div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {s.chains.map((c) => (
                              <span
                                key={c}
                                className="text-[10px] px-1.5 py-0.5 bg-vx-surface rounded text-vx-muted"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-6">
                        <div>
                          <div className="num text-xs sm:text-sm font-semibold text-vx-text">
                            {s.fills}
                          </div>
                          <div className="eyebrow text-[10px] sm:text-xs">
                            {t("solve.leaderboard.fills")}
                          </div>
                        </div>
                        <div>
                          <div className="num text-xs sm:text-sm font-semibold text-vx-text">
                            {formatUsdCompact(s.volumeUsd, bcp47)}
                          </div>
                          <div className="eyebrow text-[10px] sm:text-xs">
                            {t("solve.leaderboard.volume")}
                          </div>
                        </div>
                        <div>
                          <div className="num text-xs sm:text-sm font-semibold text-vx-text">
                            {s.avgFillTimeSeconds}s
                          </div>
                          <div className="eyebrow text-[10px] sm:text-xs">
                            {t("solve.leaderboard.avgTime")}
                          </div>
                        </div>
                        <div>
                          <div
                            className={`num text-xs sm:text-sm font-semibold ${
                              s.successRatePct > 99
                                ? "text-vx-sage"
                                : "text-vx-amber"
                            }`}
                          >
                            {s.successRatePct}%
                          </div>
                          <div className="eyebrow text-[10px] sm:text-xs">
                            {t("solve.leaderboard.success")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          </div>
        )}

        {tab === "intents" && (
          <div id="panel-intents" role="tabpanel" aria-labelledby="tab-intents">
            <OpenIntentsBoard />
          </div>
        )}

        {tab === "register" && (
          <div id="panel-register" role="tabpanel" aria-labelledby="tab-register" className="max-w-xl space-y-6">
            <div className="card p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-semibold text-vx-text">{t("solve.onboarding.title")}</h2>
                <button
                  type="button"
                  onClick={toggleOnboarding}
                  aria-expanded={!onboardingDismissed}
                  aria-controls="solver-onboarding"
                  className="text-xs text-vx-sage hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage font-medium"
                >
                  {onboardingDismissed ? t("solve.onboarding.show") : t("solve.onboarding.dismiss")}
                </button>
              </div>
              <p className="text-xs text-vx-muted leading-relaxed">{t("solve.onboarding.description")}</p>
              {!onboardingDismissed && (
                <div id="solver-onboarding" className="space-y-3 pt-4 mt-4 border-t border-vx-line">
                  {ONBOARDING_SECTIONS.map((id) => (
                    <div key={id} className="bg-vx-surface/40 p-3.5 rounded-lg border border-vx-border/50">
                      <h3 className="text-xs font-semibold text-vx-text mb-1">{t(`solve.onboarding.${id}Title` as MessageKey)}</h3>
                      <p className="text-xs text-vx-muted leading-relaxed">{t(`solve.onboarding.${id}Body` as MessageKey)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <RegistrationWizard />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
