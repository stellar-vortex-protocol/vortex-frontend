"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { SkeletonCard } from "@/components/Skeleton";
import { useSolvers } from "@/hooks/useSolvers";
import { useOpenIntents } from "@/hooks/useOpenIntents";
import { useAcceptIntent } from "@/hooks/useAcceptIntent";
import { useSolverRegistration } from "@/hooks/useSolverRegistration";
import { timeRemaining } from "@/lib/time";
import { isValidStellarPublicKey } from "@/lib/stellarAddress";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";

const usdCompact = (value: number) =>
  formatCurrency(value, undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  });

const MIN_BOND_USD = 50;

const REGISTRATION_LABEL_KEY: Record<string, MessageKey> = {
  connecting: "solve.register.states.connecting",
  building: "solve.register.states.building",
  "awaiting-signature": "solve.register.states.awaitingSignature",
  submitting: "solve.register.states.submitting",
};

export default function SolvePageClient() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"leaderboard" | "intents" | "register">("leaderboard");
  const { solvers, isLoading: solversLoading, error: solversError } = useSolvers();
  const { intents: openIntents, isLoading: intentsLoading, error: intentsError } = useOpenIntents();
  const { accept, acceptingId, error: acceptError } = useAcceptIntent();

  const [address, setAddress] = useState("");
  const [bond, setBond] = useState("");
  const registration = useSolverRegistration();
  const isRegistering = registration.status in REGISTRATION_LABEL_KEY;

  const addressError =
    address && !isValidStellarPublicKey(address)
      ? t("solve.register.validation.invalidAddress")
      : null;
  const bondError =
    bond && (isNaN(parseFloat(bond)) || parseFloat(bond) < MIN_BOND_USD)
      ? t("solve.register.validation.minimumBond", { minBond: MIN_BOND_USD })
      : null;
  const canRegister =
    Boolean(address) && Boolean(bond) && !addressError && !bondError && !isRegistering;

  const handleRegister = () => {
    if (registration.status === "success") {
      registration.reset();
      setAddress("");
      setBond("");
      return;
    }
    if (!canRegister) return;
    registration.register(address, parseFloat(bond));
  };

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={t("solve.nav.label")} />

      <main id="main-content" className="max-w-5xl mx-auto px-3 sm:px-5 py-8 sm:py-12">
        <div className="mb-8 sm:mb-10">
          <div className="eyebrow mb-2 sm:mb-3 text-xs">Solver Network</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-vx-text mb-2 sm:mb-3">
            Become a Vortex Solver
          </h1>
          <p className="text-vx-muted text-xs sm:text-sm max-w-lg leading-relaxed">
            Solvers are competitive market makers who fill user swap intents. Deposit a USDC bond,
            watch the open intent feed, and earn fees on every fill you complete.
          </p>
        </div>

        {/* How solver earns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-8 sm:mb-10">
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
          aria-label="Solver portal sections"
          className="flex gap-1 mb-6 bg-vx-surface/50 p-1 rounded-lg w-fit overflow-x-auto"
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
            <div className="px-5 py-3.5 border-b border-vx-border bg-vx-surface/30">
              <span className="text-sm font-semibold text-vx-text">
                {t("solve.leaderboard.title")}
              </span>
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
                {solvers.map((s, i) => (
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
                          <div className="text-sm font-semibold text-vx-text truncate">{s.name}</div>
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
                          <div className="num text-xs sm:text-sm font-semibold text-vx-text">{s.fills}</div>
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
                              s.successRatePct > 99 ? "text-vx-sage" : "text-vx-amber"
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

        {/* ── Open intents tab ── */}
        {tab === "intents" && (
          <div
            id="panel-intents"
            role="tabpanel"
            aria-labelledby="tab-intents"
            className="card overflow-hidden"
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
              <div role="alert" className="px-5 py-2.5 text-xs text-red-400 border-b border-vx-line">
                {acceptError}
              </div>
            )}

            {intentsLoading && openIntents.length === 0 ? (
              <div className="p-5">
                <SkeletonCard rows={3} rowHeight="h-14" />
              </div>
            ) : intentsError ? (
              <div className="p-8 text-center text-sm text-vx-muted">
                {t("solve.intents.error")}
              </div>
            ) : openIntents.length === 0 ? (
              <div className="p-8 text-center text-sm text-vx-muted">
                {t("solve.intents.empty")}
              </div>
            ) : (
              <div className="divide-y divide-vx-line">
                {openIntents.map((intent) => (
                  <div
                    key={intent.id}
                    className="px-3 sm:px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 hover:bg-vx-surface/30"
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
                      className="px-3 sm:px-4 py-2 bg-vx-sage-bg text-vx-sage text-xs font-semibold rounded-lg
                                 border border-vx-sage/30 hover:bg-vx-sage/15 transition-colors flex-shrink-0
                                 w-full sm:w-auto disabled:opacity-60 disabled:cursor-wait"
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
            className="max-w-md"
          >
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
                  onChange={(e) => setAddress(e.target.value.trim())}
                  placeholder={t("solve.register.addressPlaceholder")}
                  aria-invalid={Boolean(addressError)}
                  aria-describedby={addressError ? "solver-address-error" : undefined}
                  className="w-full bg-vx-surface border border-vx-border rounded-lg px-3 py-2.5
                             text-sm text-vx-text placeholder-vx-dim/60 focus:outline-none
                             focus:border-vx-sage/50 transition-colors"
                />
                {addressError && (
                  <p id="solver-address-error" role="alert" className="text-xs text-red-400 mt-1.5">
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
                  onChange={(e) => setBond(e.target.value)}
                  placeholder={t("solve.register.bondPlaceholder")}
                  aria-invalid={Boolean(bondError)}
                  aria-describedby={bondError ? "solver-bond-error" : undefined}
                  className="w-full bg-vx-surface border border-vx-border rounded-lg px-3 py-2.5
                             text-sm text-vx-text placeholder-vx-dim/60 focus:outline-none
                             focus:border-vx-sage/50 transition-colors"
                />
                {bondError && (
                  <p id="solver-bond-error" role="alert" className="text-xs text-red-400 mt-1.5">
                    {bondError}
                  </p>
                )}
              </div>

              <div className="bg-vx-surface/50 rounded-lg p-3 text-xs text-vx-muted space-y-1">
                <div>{t("solve.register.info.minimumBond")}</div>
                <div>{t("solve.register.info.slash")}</div>
                <div>{t("solve.register.info.withdraw")}</div>
              </div>

              {registration.status === "error" && (
                <p role="alert" className="text-xs text-red-400">
                  {registration.error}
                </p>
              )}

              <button
                type="button"
                onClick={handleRegister}
                disabled={!canRegister && registration.status !== "success"}
                aria-busy={isRegistering}
                className="btn-swap"
              >
                {isRegistering
                  ? t(REGISTRATION_LABEL_KEY[registration.status]!)
                  : registration.status === "success"
                  ? t("solve.register.button.registered")
                  : t("solve.register.button.connect")}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
