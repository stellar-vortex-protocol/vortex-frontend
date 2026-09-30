"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";

const DISMISSED_KEY = "vortex_solver_onboarding_dismissed";

const SECTIONS: { title: MessageKey; body: MessageKey }[] = [
  { title: "solve.onboarding.bondTitle", body: "solve.onboarding.bondBody" },
  { title: "solve.onboarding.metricsTitle", body: "solve.onboarding.metricsBody" },
  { title: "solve.onboarding.expectationsTitle", body: "solve.onboarding.expectationsBody" },
];

/** Collapsible readiness checklist; collapsed automatically for registered solvers. */
export function SolverOnboardingChecklist({ alreadyRegistered }: { alreadyRegistered: boolean }) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "true");
    } catch {
      // Storage unavailable — show the checklist.
    }
  }, []);

  const expanded = !dismissed && !alreadyRegistered;

  const toggle = () => {
    const next = !dismissed;
    setDismissed(next);
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(next));
    } catch {
      // Preference applies for this session only.
    }
  };

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-vx-text">{t("solve.onboarding.title")}</h3>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls="solver-onboarding-sections"
          className="text-xs text-vx-sage hover:underline font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-sage"
        >
          {expanded ? t("solve.onboarding.dismiss") : t("solve.onboarding.show")}
        </button>
      </div>
      <p className="text-xs text-vx-muted mb-4 leading-relaxed">{t("solve.onboarding.description")}</p>
      {expanded && (
        <div id="solver-onboarding-sections" className="space-y-4 pt-2 border-t border-vx-line">
          {SECTIONS.map((section) => (
            <div key={section.title} className="bg-vx-surface/40 p-3.5 rounded-lg border border-vx-border/50">
              <h4 className="text-xs font-semibold text-vx-text mb-1">{t(section.title)}</h4>
              <p className="text-xs text-vx-muted leading-relaxed">{t(section.body)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
