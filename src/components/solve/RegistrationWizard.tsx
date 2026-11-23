"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { SubmissionStepper, type SubmissionStatus } from "@/components/SubmissionStepper";
import { useSolverRegistration } from "@/hooks/useSolverRegistration";
import { useSolverVerification } from "@/hooks/useSolverVerification";
import { useLocalStorageDraft } from "@/hooks/useLocalStorageDraft";
import { useQueryState } from "@/hooks/useQueryState";
import { useWalletStore } from "@/store/wallet";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import {
  ELIGIBILITY_CHECKS,
  INITIAL_WIZARD_STATE,
  SOLVER_BOND_CONFIG,
  WIZARD_STEPS,
  evaluateEligibility,
  formatAmount,
  minBondUnits,
  parseAmount,
  suggestedBonds,
  validateStep,
  wizardReducer,
  type CheckStatus,
  type Eligibility,
  type WizardContext,
  type WizardDraft,
  type WizardState,
  type WizardStep,
} from "@/lib/registrationWizard";

const DRAFT_KEY = "vortex:solver-registration-wizard";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

type FundedState = { status: "idle" | "pending" | "done" | "error"; funded: boolean | null };

/** Horizon funding check via the same-origin proxy; cancelable. */
function useAccountFunded(address: string | null) {
  const [state, setState] = useState<FundedState>({ status: "idle", funded: null });
  const controller = useRef<AbortController | null>(null);

  const check = useCallback(() => {
    controller.current?.abort();
    if (!address) {
      setState({ status: "idle", funded: null });
      return;
    }
    const ac = new AbortController();
    controller.current = ac;
    setState({ status: "pending", funded: null });
    fetch(`/api/account-status?address=${encodeURIComponent(address)}`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { funded?: boolean };
        setState({ status: "done", funded: body.funded === true });
      })
      .catch(() => {
        if (!ac.signal.aborted) setState({ status: "error", funded: null });
      });
  }, [address]);

  const cancel = useCallback(() => {
    controller.current?.abort();
    setState({ status: "error", funded: null });
  }, []);

  useEffect(() => {
    check();
    return () => controller.current?.abort();
  }, [check]);

  return { ...state, check, cancel };
}

const STATUS_ICON: Record<CheckStatus, string> = { pass: "✓", fail: "✕", pending: "…" };
const STATUS_CLASS: Record<CheckStatus, string> = {
  pass: "text-vx-sage",
  fail: "text-red-400",
  pending: "text-vx-muted",
};

function EligibilityStep({
  eligibility,
  fundedStatus,
  onRetryFunded,
  onCancelFunded,
}: {
  eligibility: Eligibility;
  fundedStatus: FundedState["status"];
  onRetryFunded: () => void;
  onCancelFunded: () => void;
}) {
  const { t } = useTranslation();
  const connect = useWalletStore((s) => s.connect);
  return (
    <ul className="space-y-2">
      {ELIGIBILITY_CHECKS.map((id) => {
        const status = eligibility[id];
        return (
          <li key={id} className="flex items-start gap-3 bg-vx-surface/40 rounded-lg p-3 border border-vx-border/50">
            <span aria-hidden="true" className={`font-mono text-sm ${STATUS_CLASS[status]}`}>{STATUS_ICON[status]}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-vx-text">
                {t(`solve.wizard.check.${id}.label` as MessageKey)}{" "}
                <span className={`font-normal ${STATUS_CLASS[status]}`}>({t(`solve.wizard.status.${status}` as MessageKey)})</span>
              </div>
              {status === "fail" && (
                <p className="text-[11px] text-vx-muted mt-0.5">{t(`solve.wizard.check.${id}.fix` as MessageKey)}</p>
              )}
              {id === "wallet" && status === "fail" && (
                <button type="button" onClick={() => void connect()} className="mt-1.5 text-xs text-vx-sage hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage rounded">
                  {t("solve.wizard.connectWallet")}
                </button>
              )}
              {id === "funded" && fundedStatus === "pending" && (
                <button type="button" onClick={onCancelFunded} className="mt-1.5 text-xs text-vx-muted hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage rounded">
                  {t("solve.wizard.cancelCheck")}
                </button>
              )}
              {id === "funded" && fundedStatus === "error" && (
                <button type="button" onClick={onRetryFunded} className="mt-1.5 text-xs text-vx-sage hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage rounded">
                  {t("solve.wizard.retryCheck")}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const inputClass =
  "w-full bg-vx-surface border border-vx-border rounded-lg px-3 py-2.5 text-sm text-vx-text placeholder-vx-dim/60 focus:outline-none focus:ring-2 focus:ring-vx-sage focus:border-vx-sage/50 transition-colors";

function VerifyStep({ state, walletAddress, error, onChange }: { state: WizardState; walletAddress: string | null; error: string | null; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <label htmlFor="solver-address" className="eyebrow block text-xs">{t("solve.register.addressLabel")}</label>
      <input
        id="solver-address"
        type="text"
        value={state.address}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("solve.register.addressPlaceholder")}
        aria-invalid={Boolean(state.address && error)}
        aria-describedby="solver-address-help"
        className={inputClass}
      />
      <p id="solver-address-help" className="text-[11px] text-vx-muted">{t("solve.wizard.verifyHelp")}</p>
      {walletAddress && state.address !== walletAddress && (
        <button type="button" onClick={() => onChange(walletAddress)} className="text-xs text-vx-sage hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage rounded">
          {t("solve.wizard.useConnected")}
        </button>
      )}
      {state.address && error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function BondStep({ state, error, onChange }: { state: WizardState; error: string | null; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const min = minBondUnits();
  const units = parseAmount(state.bond);
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="solver-bond" className="eyebrow block mb-2 text-xs">{t("solve.register.bondLabel")}</label>
        <input
          id="solver-bond"
          type="text"
          inputMode="decimal"
          value={state.bond}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("solve.register.bondPlaceholder")}
          aria-invalid={Boolean(state.bond && error)}
          aria-describedby="solver-bond-calc"
          className={inputClass}
        />
        {state.bond && error && <p role="alert" className="text-xs text-red-400 mt-1.5">{error}</p>}
      </div>
      <div role="group" aria-label={t("solve.wizard.suggested")} className="flex flex-wrap gap-2">
        {suggestedBonds(min).map((amount) => (
          <button
            key={amount}
            type="button"
            aria-pressed={state.bond === amount}
            onClick={() => onChange(amount)}
            className="px-2.5 py-1 rounded border border-vx-border text-xs text-vx-text hover:border-vx-sage/50 aria-pressed:bg-vx-sage-bg aria-pressed:text-vx-sage focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
          >
            ${amount}
          </button>
        ))}
      </div>
      <p id="solver-bond-calc" className="text-[11px] text-vx-muted">
        {t("solve.wizard.bondCalc", { min: formatAmount(min), units: formatAmount(units) })}
      </p>
    </div>
  );
}

function ReviewStep({ state }: { state: WizardState }) {
  const { t } = useTranslation();
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-vx-muted">{t("solve.register.addressLabel")}</dt>
        <dd className="text-vx-text font-mono text-xs break-all text-right">{state.address || "—"}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-vx-muted">{t("solve.register.bondLabel")}</dt>
        <dd className="text-vx-text">${state.bond || "—"}</dd>
      </div>
    </dl>
  );
}

export function RegistrationWizard() {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_WIZARD_STATE);
  const [error, setError] = useState<string | null>(null);
  const walletAddress = useWalletStore((s) => s.address);
  const funded = useAccountFunded(walletAddress);
  const eligibility = useMemo(
    () => evaluateEligibility({ walletAddress, funded: funded.funded }),
    [walletAddress, funded.funded],
  );

  const stepIndex = WIZARD_STEPS.indexOf(state.step);
  const stepLabel = t(`solve.wizard.step.${state.step}.title` as MessageKey);

  const goTo = useCallback((step: WizardStep) => {
    setError(null);
    dispatch({ type: "goto", step });
  }, []);

  const next = useCallback(() => {
    const result = validateStep(state.step, state);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    dispatch({ type: "next" });
  }, [state]);

  const back = useCallback(() => {
    setError(null);
    dispatch({ type: "back" });
  }, []);

  return (
    <section aria-labelledby="registration-wizard-title" className="space-y-6">
      <div>
        <h1 id="registration-wizard-title" className="text-xl font-semibold text-vx-text">
          {t("solve.register.title")}
        </h1>
        <p className="text-xs text-vx-muted mt-1">{t("solve.register.subtitle")}</p>
      </div>

      <ol aria-label={t("solve.wizard.progress")} className="flex flex-wrap gap-2">
        {WIZARD_STEPS.map((step, i) => {
          const active = step === state.step;
          return (
            <li key={step}>
              <button
                type="button"
                onClick={() => goTo(step)}
                aria-current={active ? "step" : undefined}
                className={`px-2.5 py-1 rounded text-xs border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage ${
                  active
                    ? "border-vx-sage/60 bg-vx-sage-bg text-vx-sage"
                    : "border-vx-border text-vx-muted hover:text-vx-text"
                }`}
              >
                <span aria-hidden="true" className="font-mono mr-1">{i + 1}.</span>
                {t(`solve.wizard.step.${step}.title` as MessageKey)}
              </button>
            </li>
          );
        })}
      </ol>

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {t("solve.wizard.announce", { current: stepIndex + 1, total: WIZARD_STEPS.length, title: stepLabel })}
      </p>

      <div className="bg-vx-surface/40 rounded-xl p-4 border border-vx-border/50 space-y-4">
        <h2 className="text-sm font-semibold text-vx-text">{stepLabel}</h2>
        {state.step === "eligibility" && (
          <EligibilityStep
            eligibility={eligibility}
            fundedStatus={funded.status}
            onRetryFunded={funded.check}
            onCancelFunded={funded.cancel}
          />
        )}
        {state.step === "verify" && (
          <VerifyStep
            state={state}
            walletAddress={walletAddress}
            error={error}
            onChange={(v) => dispatch({ type: "set", field: "address", value: v })}
          />
        )}
        {state.step === "bond" && (
          <BondStep
            state={state}
            error={error}
            onChange={(v) => dispatch({ type: "set", field: "bond", value: v })}
          />
        )}
        {state.step === "review" && <ReviewStep state={state} />}

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={back}
            disabled={stepIndex === 0}
            className="px-3 py-1.5 rounded border border-vx-border text-xs text-vx-text disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
          >
            {t("solve.wizard.back")}
          </button>
          <button
            type="button"
            onClick={next}
            disabled={stepIndex === WIZARD_STEPS.length - 1}
            className="px-3 py-1.5 rounded bg-vx-sage text-vx-bg text-xs font-semibold disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
          >
            {t("solve.wizard.next")}
          </button>
        </div>
      </div>
    </section>
  );
}
