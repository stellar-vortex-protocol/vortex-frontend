"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const STORAGE_KEY = "vortex-onboarding-seen";

type Step = {
  targetId: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    targetId: "swap-card-region",
    title: "Start a swap here",
    body: "Enter an amount on any supported chain. You're creating an intent, not a trade - competing solvers fill it and the funds land on Stellar.",
  },
  {
    targetId: "live-feed-region",
    title: "Watch it settle live",
    body: "The activity feed streams real fills as solvers complete them, so you can see the network working in real time.",
  },
  {
    targetId: "solver-portal-link",
    title: "Run a solver",
    body: "Solvers post a bond and compete to fill intents for a fee. If you want to provide liquidity, start from the solver portal.",
  },
];

function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private mode / storage disabled - treat as seen so we never nag.
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Ignore - the sequence just won't be suppressed next load.
  }
}

export function OnboardingHints() {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Only start the sequence for a genuine first visit, and only once the DOM the
  // steps point at is present.
  useEffect(() => {
    if (hasSeenOnboarding()) return;
    if (STEPS.some((step) => !document.getElementById(step.targetId))) return;
    setStepIndex(0);
  }, []);

  const dismiss = useCallback(() => {
    markSeen();
    setStepIndex(null);
  }, []);

  const step = stepIndex === null ? null : STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  // Position the card just below its target; recompute on step change / resize.
  useLayoutEffect(() => {
    if (!step) return;
    const measure = () => {
      const el = document.getElementById(step.targetId);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  useEffect(() => {
    if (!step) return;
    cardRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [step, dismiss]);

  if (!step || stepIndex === null) return null;

  const animate =
    typeof document !== "undefined" && document.documentElement.dataset.motion !== "reduce";

  // Fall back to a centred card when the target isn't measurable.
  const cardStyle: React.CSSProperties = rect
    ? {
        position: "fixed",
        top: Math.min(rect.bottom + 12, window.innerHeight - 220),
        left: Math.min(Math.max(rect.left, 12), window.innerWidth - 332),
        width: 320,
      }
    : { position: "fixed", top: "40%", left: "50%", transform: "translate(-50%,-50%)", width: 320 };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/40"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      {/* Spotlight ring around the current target. */}
      {rect && (
        <div
          aria-hidden="true"
          className="fixed rounded-xl ring-2 ring-vx-sage pointer-events-none"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        style={cardStyle}
        className={`rounded-xl border border-vx-border bg-vx-card p-4 shadow-2xl focus:outline-none ${
          animate ? "animate-fade-up" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="onboarding-title" className="text-sm font-semibold text-vx-text">
            {step.title}
          </h2>
          <span className="text-[10px] text-vx-muted whitespace-nowrap">
            {stepIndex + 1} / {STEPS.length}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-vx-muted">{step.body}</p>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={dismiss}
            className="text-[11px] text-vx-muted hover:text-vx-text transition-colors"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex(stepIndex - 1)}
                className="text-[11px] px-2.5 py-1 rounded-md border border-vx-border text-vx-muted hover:text-vx-text transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? dismiss() : setStepIndex(stepIndex + 1))}
              className="text-[11px] px-2.5 py-1 rounded-md bg-vx-sage-bg text-vx-sage border border-vx-sage/30 transition-colors"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
