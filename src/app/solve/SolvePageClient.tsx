"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SolverLeaderboard } from "@/components/solve/SolverLeaderboard";
import { OpenIntentsBoard } from "@/components/solve/OpenIntentsBoard";
import { RegistrationWizard } from "@/components/solve/RegistrationWizard";
import { useQueryState } from "@/hooks/useQueryState";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";

const TABS = ["leaderboard", "intents", "register"] as const;
type Tab = (typeof TABS)[number];

const ONBOARDING_DISMISSED_KEY = "vortex_solver_onboarding_dismissed";
const STEP_IDS = ["registerBond", "watchIntentFeed", "fillAndEarn"] as const;
const ONBOARDING_SECTIONS = ["bond", "metrics", "expectations"] as const;

function readDismissed(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

export default function SolvePageClient() {
  const { t } = useTranslation();
  const { params, update } = useQueryState();
  const tabParam = params.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as Tab) : "leaderboard";

  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(() =>
    typeof window !== "undefined" ? readDismissed() : false,
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
          <div id="panel-leaderboard" role="tabpanel" aria-labelledby="tab-leaderboard">
            <SolverLeaderboard />
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
