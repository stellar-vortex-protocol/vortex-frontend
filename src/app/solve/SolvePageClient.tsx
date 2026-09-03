"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SkeletonCard } from "@/components/Skeleton";
import { useSolvers } from "@/hooks/useSolvers";
import { useOpenIntents } from "@/hooks/useOpenIntents";
import { useAcceptIntent } from "@/hooks/useAcceptIntent";
import { useSolverRegistration } from "@/hooks/useSolverRegistration";
import { useLocalStorageDraft } from "@/hooks/useLocalStorageDraft";
import { useWalletStore } from "@/store/wallet";
import { timeRemaining } from "@/lib/time";
import { isValidStellarPublicKey } from "@/lib/stellarAddress";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";
import { sanitizeDisplayText } from "@/lib/textSafety";
import Link from "next/link";

const TABS = ["leaderboard", "intents", "register"] as const;
type Tab = (typeof TABS)[number];

const MIN_BOND_USD = 50;
const ONBOARDING_DISMISSED_KEY = "vortex_solver_onboarding_dismissed";

/** Shape of the persisted registration draft. */
type RegistrationDraft = {
  address: string;
  bond: string;
};

function usdCompact(amount: number) {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}k`;
  return `$${amount}`;
}

function formatTimeRemaining(deadlineStr: string): string {
  const ms = new Date(deadlineStr).getTime() - Date.now();
  if (ms <= 0) return "0m";
  const mins = Math.ceil(ms / 60_000);
  return `${mins}m`;
}

export default function SolvePageClient() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"leaderboard" | "intents" | "register">("leaderboard");
  const { solvers, isLoading: solversLoading, error: solversError } = useSolvers();
  const { intents: openIntents, isLoading: intentsLoading, error: intentsError } = useOpenIntents();
  const { accept, acceptingId, error: acceptError } = useAcceptIntent();
  const { register, status: regStatus, error: regError, reset } =
    useSolverRegistration();

  // Draft persistence — scoped to the currently connected wallet so that
  // switching wallets never silently restores the wrong address.
  const connectedAddress = useWalletStore((s) => s.address);
  const [draft, setDraft, clearDraft] = useLocalStorageDraft<RegistrationDraft>(
    "vortex:solver-registration-draft",
    connectedAddress ?? null,
  );

  const [address, setAddress] = useState(draft?.address ?? "");
  const [bond, setBond] = useState(draft?.bond ?? "");

  // Sync form fields into the draft whenever they change.
  const handleAddressChange = (value: string) => {
    setAddress(value);
    setDraft({ address: value, bond });
  };
  const handleBondChange = (value: string) => {
    setBond(value);
    setDraft({ address, bond: value });
  };

  const registration = useSolverRegistration();
  const isRegistering = registration.status in REGISTRATION_LABEL_KEY;

  // Clear draft after successful submission.
  useEffect(() => {
    if (registration.status === "success") {
      clearDraft();
    }
  }, [registration.status, clearDraft]);

  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "true";
    }
    return false;
  });

  const isAlreadyRegistered = Boolean(
    address && solvers.some((s) => s.address.toLowerCase() === address.toLowerCase())
  );
  const showOnboardingExpanded = !onboardingDismissed && !isAlreadyRegistered;

  const toggleOnboarding = () => {
    const nextState = !onboardingDismissed;
    setOnboardingDismissed(nextState);
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, String(nextState));
    }
  };

  const addressError =
    address && !isValidStellarPublicKey(address)
      ? t("solve.register.validation.invalidAddress")
      : null;
  const bondError =
    bond && (isNaN(parseFloat(bond)) || parseFloat(bond) < MIN_BOND_USD)
      ? t("solve.register.validation.minimumBond", { minBond: MIN_BOND_USD })
      : null;
  const networkMismatch = useWalletStore((s) => s.networkMismatch);
  const canRegister =
    Boolean(address) && Boolean(bond) && !addressError && !bondError && !isRegistering && !networkMismatch;

  const sortedSolvers = [...solvers].sort((a, b) => {
    if (!sortKey || sortDir === "none") return 0;
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    // Stable numeric comparison
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortDir("none");
      setSortKey(null);
    } else {
      setSortDir("asc");
    }
  };

  const sortedSolvers = useMemo(() => {
    return [...solvers].sort((a, b) => {
      if (sortField === "name") {
        return sortDirection === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortField === "volume") {
        return sortDirection === "asc"
          ? a.volumeUsd - b.volumeUsd
          : b.volumeUsd - a.volumeUsd;
      }
      if (sortField === "fills") {
        return sortDirection === "asc" ? a.fills - b.fills : b.fills - a.fills;
      }
      if (sortField === "success") {
        return sortDirection === "asc"
          ? a.successRatePct - b.successRatePct
          : b.successRatePct - a.successRatePct;
      }
      return 0;
    });
  }, [solvers, sortField, sortDirection]);

  const handleSort = (field: "name" | "volume" | "fills" | "success") => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "name" ? "asc" : "desc");
    }
  };

  const addressError = useMemo(() => {
    if (!address) return submitted ? getMessage("solve.register.validation.invalidAddress") : null;
    if (!isValidStellarPublicKey(address)) {
      return getMessage("solve.register.validation.invalidAddress");
    }
    return null;
  }, [address, submitted]);

  const bondError = useMemo(() => {
    if (!bond) return submitted ? getMessage("solve.register.validation.minimumBond", { minBond: MIN_BOND_USDC }) : null;
    const num = parseFloat(bond);
    if (isNaN(num) || num < MIN_BOND_USDC) {
      return getMessage("solve.register.validation.minimumBond", { minBond: MIN_BOND_USDC });
    }
    return null;
  }, [bond, submitted]);

  const canSubmit = Boolean(address && bond && !addressError && !bondError);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regStatus === "success") {
      reset();
      setAddress("");
      setBond("");
      clearDraft();
      return;
    }
    setSubmitted(true);
    setAddressTouched(true);
    setBondTouched(true);

    if (!canSubmit) return;

    await register(address, parseFloat(bond));
  };

  let submitButtonText = getMessage("solve.register.button.connect");
  if (regStatus === "success") {
    submitButtonText = getMessage("solve.register.button.registered");
  } else if (regStatus === "connecting") {
    submitButtonText = getMessage("solve.register.states.connecting");
  } else if (regStatus === "building") {
    submitButtonText = getMessage("solve.register.states.building");
  } else if (regStatus === "awaiting-signature") {
    submitButtonText = getMessage("solve.register.states.awaitingSignature");
  } else if (regStatus === "submitting") {
    submitButtonText = getMessage("solve.register.states.submitting");
  }

  const isBusy = ["connecting", "building", "awaiting-signature", "submitting"].includes(regStatus);

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={t("solve.nav.label")} />

      <main id="main-content" className="max-w-5xl mx-auto px-5 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="eyebrow mb-3">{getMessage("solve.hero.eyebrow")}</div>
          <h1 className="text-3xl font-bold text-vx-text mb-3">
            {getMessage("solve.hero.title")}
          </h1>
          <p className="text-vx-muted text-sm max-w-lg leading-relaxed">
            {getMessage("solve.hero.description")}
          </p>
        </div>

        {/* Steps strip */}
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          {[
            {
              n: t("solve.steps.registerBond.number"),
              title: t("solve.steps.registerBond.title"),
              body: t("solve.steps.registerBond.body"),
            },
            {
              n: t("solve.steps.watchIntentFeed.number"),
              title: t("solve.steps.watchIntentFeed.title"),
              body: t("solve.steps.watchIntentFeed.body"),
            },
            {
              n: t("solve.steps.fillAndEarn.number"),
              title: t("solve.steps.fillAndEarn.title"),
              body: t("solve.steps.fillAndEarn.body"),
            },
          ].map((item) => (
            <div key={item.n} className="card p-4 sm:p-5">
              <div className="font-mono text-xs text-vx-sage mb-2 sm:mb-3">{item.n}</div>
              <h3 className="text-xs sm:text-sm font-semibold text-vx-text mb-2">{item.title}</h3>
              <p className="text-xs text-vx-muted leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label={getMessage("solve.tabs.ariaLabel")}
          className="flex border-b border-vx-border gap-1 mb-8 overflow-x-auto"
        >
          {(["leaderboard", "intents", "register"] as const).map((tabId) => (
            <button
              key={tabId}
              type="button"
              role="tab"
              id={`tab-${tabId}`}
              aria-selected={tab === tabId}
              aria-controls={`panel-${tabId}`}
              onClick={() => setTab(tabId)}
              className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium capitalize transition-all whitespace-nowrap
                ${tab === tabId
                  ? "bg-vx-card text-vx-text border border-vx-border"
                  : "text-vx-muted hover:text-vx-text"
                }`}
            >
              {t(`solve.tabs.${tabId}`)}
            </button>
          ))}
        </div>

        {/* ── Leaderboard tab ── */}
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
                            {usdCompact(s.volumeUsd)}
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
        )}

        {/* ── Open Intents tab ── */}
        {tab === "intents" && (
          <div
            id="panel-intents"
            role="tabpanel"
            aria-labelledby="tab-intents"
            className="space-y-4"
          >
            <div className="px-5 py-3.5 border-b border-vx-border bg-vx-surface/30 flex items-center justify-between">
              <span className="text-sm font-semibold text-vx-text">
                {t("solve.intents.title")}
              </span>
              <span className="chip bg-vx-sage-bg text-vx-sage text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-vx-sage animate-pulse" />
                {t("solve.intents.available", { count: openIntents.length })}
              </span>
            </div>

            {acceptError && (
              <div
                role="alert"
                className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400"
              >
                {acceptError}
              </div>
            )}

            {intentsLoading && intents.length === 0 ? (
              <SkeletonCard rows={3} rowHeight="h-16" />
            ) : intentsError ? (
              <div className="p-8 text-center text-sm text-vx-muted">
                {t("solve.intents.error")}
              </div>
            ) : openIntents.length === 0 ? (
              <div className="p-8 text-center text-sm text-vx-muted">
                {t("solve.intents.empty")}
              </div>
            ) : (
              <div className="space-y-2">
                {intents.map((intent) => (
                  <div
                    key={intent.id}
                    className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="num text-xs text-vx-muted mb-1 capitalize">
                        {t("solve.intents.id", { id: intent.id })}
                      </div>
                      <div className="text-sm font-medium text-vx-text capitalize">
                        {intent.srcAmount} {intent.srcToken} on {intent.srcChain}
                      </div>
                      <div className="text-xs text-vx-muted">
                        {t("solve.intents.details", {
                          minOut: intent.minOut,
                          dstToken: intent.dstToken,
                          timeRemaining: timeRemaining(intent.deadline),
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => accept(intent.id)}
                      disabled={acceptingId === intent.id}
                      aria-busy={acceptingId === intent.id}
                      className="px-3 sm:px-4 py-2 bg-vx-sage-bg text-vx-sage text-xs font-semibold rounded-lg border border-vx-sage/30 hover:bg-vx-sage/15 transition-colors flex-shrink-0 w-full sm:w-auto disabled:opacity-60 disabled:cursor-wait"
                    >
                      {acceptingId === intent.id
                        ? t("solve.intents.accepting")
                        : t("solve.intents.accept")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Register tab ── */}
        {tab === "register" && (
          <div
            id="panel-register"
            role="tabpanel"
            aria-labelledby="tab-register"
            className="max-w-xl space-y-6"
          >
            {/* Solver Onboarding Checklist & Readiness Section */}
            <div className="card p-4 sm:p-6 bg-vx-card border border-vx-border rounded-xl">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-vx-sage animate-pulse" />
                  <h3 className="text-sm font-semibold text-vx-text">
                    {getMessage("solve.onboarding.title")}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={toggleOnboarding}
                  className="text-xs text-vx-sage hover:underline focus:outline-none font-medium"
                >
                  {showOnboardingExpanded
                    ? getMessage("solve.onboarding.dismiss")
                    : getMessage("solve.onboarding.show")}
                </button>
              </div>

              <p className="text-xs text-vx-muted mb-4 leading-relaxed">
                {getMessage("solve.onboarding.description")}
              </p>

              {showOnboardingExpanded && (
                <div className="space-y-4 pt-2 border-t border-vx-line">
                  <div className="bg-vx-surface/40 p-3.5 rounded-lg border border-vx-border/50">
                    <h4 className="text-xs font-semibold text-vx-text mb-1">
                      {getMessage("solve.onboarding.bondTitle")}
                    </h4>
                    <p className="text-xs text-vx-muted leading-relaxed">
                      {getMessage("solve.onboarding.bondBody")}
                    </p>
                  </div>

                  <div className="bg-vx-surface/40 p-3.5 rounded-lg border border-vx-border/50">
                    <h4 className="text-xs font-semibold text-vx-text mb-1">
                      {getMessage("solve.onboarding.metricsTitle")}
                    </h4>
                    <p className="text-xs text-vx-muted leading-relaxed">
                      {getMessage("solve.onboarding.metricsBody")}
                    </p>
                  </div>

                  <div className="bg-vx-surface/40 p-3.5 rounded-lg border border-vx-border/50">
                    <h4 className="text-xs font-semibold text-vx-text mb-1">
                      {getMessage("solve.onboarding.expectationsTitle")}
                    </h4>
                    <p className="text-xs text-vx-muted leading-relaxed">
                      {getMessage("solve.onboarding.expectationsBody")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="card p-4 sm:p-6 space-y-4 sm:space-y-5">
              <div>
                <h3 className="text-base font-semibold text-vx-text mb-1">
                  {t("solve.register.title")}
                </h3>
                <p className="text-xs text-vx-muted">{t("solve.register.description")}</p>
              </div>

              <div>
                <label htmlFor="solver-address" className="eyebrow block mb-2 text-xs">
                  {t("solve.register.addressLabel")}
                </label>
                <input
                  id="solver-address"
                  type="text"
                  value={address}
                  onChange={(e) => handleAddressChange(e.target.value.trim())}
                  placeholder={getMessage("solve.register.addressPlaceholder")}
                  aria-invalid={Boolean(addressError)}
                  aria-describedby={
                    addressError ? "solver-address-error" : undefined
                  }
                  className="w-full bg-vx-surface border border-vx-border rounded-lg px-3 py-2.5 text-sm text-vx-text placeholder-vx-dim/60 focus:outline-none focus:ring-2 focus:ring-vx-sage focus:border-vx-sage/50 transition-colors"
                />
                {addressError && (
                  <p
                    id="solver-address-error"
                    role="alert"
                    className="text-xs text-red-400 mt-1.5"
                  >
                    {addressError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="solver-bond" className="eyebrow block mb-2 text-xs">
                  {t("solve.register.bondLabel")}
                </label>
                <input
                  id="solver-bond"
                  type="number"
                  value={bond}
                  onChange={(e) => handleBondChange(e.target.value)}
                  placeholder={getMessage("solve.register.bondPlaceholder")}
                  aria-invalid={Boolean(bondError)}
                  aria-describedby={bondError ? "solver-bond-error" : undefined}
                  className="w-full bg-vx-surface border border-vx-border rounded-lg px-3 py-2.5 text-sm text-vx-text placeholder-vx-dim/60 focus:outline-none focus:ring-2 focus:ring-vx-sage focus:border-vx-sage/50 transition-colors"
                />
                {bondError && (
                  <p
                    id="solver-bond-error"
                    role="alert"
                    className="text-xs text-red-400 mt-1.5"
                  >
                    {bondError}
                  </p>
                )}
              </div>

              <div className="bg-vx-surface/50 rounded-lg p-3 text-xs text-vx-muted space-y-1">
                <div>{t("solve.register.info.minimumBond")}</div>
                <div>{t("solve.register.info.slash")}</div>
                <div>{t("solve.register.info.withdraw")}</div>
              </div>

              {registration.status !== "idle" && registration.status !== "success" && (
                <SubmissionStepper status={registration.status} errorStep={registration.errorStep} />
              )}

              {registration.status === "error" && (
                <p role="alert" className="text-xs text-red-400">
                  {registration.error}
                </p>
              )}

              {networkMismatch && (
                <p role="alert" className="text-xs text-yellow-400">
                  ⚠ Wrong network — switch Freighter to{" "}
                  <span className="font-semibold">
                    {process.env["NEXT_PUBLIC_NETWORK"] ?? "testnet"}
                  </span>{" "}
                  before registering.
                </p>
              )}

              <button
                type="button"
                onClick={handleRegisterSubmit}
                disabled={(!canRegister && regStatus !== "success") || isBusy}
                aria-busy={isBusy}
                className="w-full py-2.5 bg-vx-sage-bg text-vx-sage text-xs font-semibold rounded-lg border border-vx-sage/30 hover:bg-vx-sage/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isRegistering
                  ? t(REGISTRATION_LABEL_KEY[registration.status]!)
                  : registration.status === "success"
                  ? t("solve.register.button.registered")
                  : networkMismatch
                  ? t("solve.register.button.wrongNetwork")
                  : t("solve.register.button.connect")}
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
