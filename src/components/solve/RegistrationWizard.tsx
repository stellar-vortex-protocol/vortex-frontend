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
      <dl id="solver-bond-calc" className="bg-vx-surface/50 rounded-lg p-3 text-xs grid grid-cols-2 gap-y-1.5">
        <dt className="text-vx-muted">{t("solve.wizard.calc.minimum")}</dt>
        <dd className="num text-right text-vx-text">${formatAmount(min)}</dd>
        <dt className="text-vx-muted">{t("solve.wizard.calc.usd")}</dt>
        <dd className="num text-right text-vx-text">{units !== null ? `$${formatAmount(units)}` : "—"}</dd>
        <dt className="text-vx-muted">{t("solve.wizard.calc.asset", { asset: SOLVER_BOND_CONFIG.assetCode })}</dt>
        <dd className="num text-right text-vx-text">{units !== null ? `${formatAmount(units)} ${SOLVER_BOND_CONFIG.assetCode}` : "—"}</dd>
        <dt className="text-vx-muted">{t("solve.wizard.calc.lock")}</dt>
        <dd className="num text-right text-vx-text">{t("solve.wizard.calc.lockDays", { days: SOLVER_BOND_CONFIG.lockDays })}</dd>
      </dl>
    </div>
  );
}

export function RegistrationWizard() {
  const { t } = useTranslation();
  const { params, update } = useQueryState();
  const isConnected = useWalletStore((s) => s.isConnected);
  const walletAddress = useWalletStore((s) => s.address);
  const networkMismatch = useWalletStore((s) => s.networkMismatch);
  const { isLoading: solversLoading, error: solversError, verifySolver } = useSolverVerification();
  const registration = useSolverRegistration();
  const funded = useAccountFunded(isConnected ? walletAddress : null);

  const [state, dispatch] = useReducer(wizardReducer, INITIAL_WIZARD_STATE);
  const [draft, setDraft, clearDraft] = useLocalStorageDraft<WizardDraft>(DRAFT_KEY, walletAddress ?? null, { ttlMs: DRAFT_TTL_MS });
  const [resumeOffered, setResumeOffered] = useState(() => Boolean(draft && draft.step !== "eligibility"));
  const [showErrors, setShowErrors] = useState(false);

  const minBond = minBondUnits();
  const isRegistered = Boolean(walletAddress && verifySolver(walletAddress).isVerified);
  const eligibility = evaluateEligibility({
    isConnected,
    walletAddress,
    networkMismatch,
    solversLoaded: !solversLoading && !solversError,
    isRegistered,
    funded: funded.funded,
  });
  const ctx: WizardContext = { eligibility, walletAddress, isRegistered: Boolean(state.address && verifySolver(state.address).isVerified), minBond };
  const stepErrorKey = validateStep(state.step, state, ctx);
  const stepError = stepErrorKey ? t(stepErrorKey, { minBond: formatAmount(minBond) }) : null;

  // Persist progress (wallet-scoped, TTL) — never once registration is done.
  useEffect(() => {
    if (resumeOffered) return;
    if (state.step === "done") return;
    if (state === INITIAL_WIZARD_STATE) return;
    setDraft({ step: state.step, maxStep: state.maxStep, address: state.address, bond: state.bond });
  }, [state, resumeOffered, setDraft]);

  // Wallet switched mid-wizard → reset with a notice.
  const prevWallet = useRef(walletAddress);
  useEffect(() => {
    if (prevWallet.current && walletAddress !== prevWallet.current && state.maxStep > 0 && state.step !== "done") {
      dispatch({ type: "reset", notice: "walletChanged" });
      registration.reset();
      clearDraft();
      update({ step: null });
    }
    prevWallet.current = walletAddress;
  }, [walletAddress]); // eslint-disable-line react-hooks/exhaustive-deps -- only react to wallet changes

  // Browser back/forward: follow `?step=` when it points at a reachable step.
  const urlStep = params.get("step");
  useEffect(() => {
    if (urlStep && urlStep !== state.step && (WIZARD_STEPS as readonly string[]).includes(urlStep)) {
      dispatch({ type: "goto", step: urlStep as WizardStep });
    } else if (!urlStep && state.step !== "eligibility" && state.step !== "done") {
      dispatch({ type: "goto", step: "eligibility" });
    }
  }, [urlStep]); // eslint-disable-line react-hooks/exhaustive-deps -- URL is the source of truth here

  // Guard: a URL update can re-render before `complete` is applied, so make
  // sure the completion side effects run only once per successful submission.
  const completedRef = useRef(false);
  useEffect(() => {
    if (registration.status !== "success") completedRef.current = false;
    if (registration.status === "success" && state.step === "review" && !completedRef.current) {
      completedRef.current = true;
      dispatch({ type: "complete" });
      clearDraft();
      update({ step: "done" }, "replace");
    }
  }, [registration.status, state.step, clearDraft, update]);

  const goNext = () => {
    if (stepErrorKey) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    const next = WIZARD_STEPS[WIZARD_STEPS.indexOf(state.step) + 1] ?? null;
    dispatch({ type: "next", ctx });
    update({ step: next }, "push");
  };
  const goBack = () => {
    const prev = WIZARD_STEPS[WIZARD_STEPS.indexOf(state.step) - 1];
    dispatch({ type: "back" });
    update({ step: !prev || prev === "eligibility" ? null : prev }, "push");
  };

  const resume = () => {
    if (draft) {
      dispatch({ type: "restore", draft, minBond });
      update({ step: draft.step === "eligibility" ? null : draft.step }, "replace");
    }
    setResumeOffered(false);
  };
  const startOver = () => {
    clearDraft();
    dispatch({ type: "reset" });
    update({ step: null }, "replace");
    setResumeOffered(false);
  };

  const submit = () => {
    const units = parseAmount(state.bond);
    if (units === null) return;
    // bondUsd is a JS number in the API; formatAmount keeps it to 7 dp exactly.
    void registration.register(state.address, Number(formatAmount(units)));
  };

  const busy = ["connecting", "building", "reviewing", "awaiting-signature", "submitting"].includes(registration.status);
  // The stepper has no separate "reviewing" phase — XDR review is part of "building".
  const stepperStatus: SubmissionStatus =
    registration.status === "reviewing" ? "building" : registration.status;
  const errorStep =
    registration.errorStep === "reviewing" ? "building" : registration.errorStep;
  const stepIdx = WIZARD_STEPS.indexOf(state.step);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [state.step]);

  const summary = useMemo(
    () => [
      { label: t("solve.register.addressLabel"), value: state.address || "—" },
      { label: t("solve.register.bondLabel"), value: state.bond ? `$${state.bond}` : "—" },
      { label: t("solve.wizard.calc.lock"), value: t("solve.wizard.calc.lockDays", { days: SOLVER_BOND_CONFIG.lockDays }) },
    ],
    [state.address, state.bond, t],
  );

  return (
    <div className="card p-4 sm:p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-vx-text mb-1">{t("solve.register.title")}</h2>
        <p className="text-xs text-vx-muted">{t("solve.register.description")}</p>
      </div>

      {resumeOffered && draft && (
        <div role="region" aria-label={t("solve.wizard.resume.title")} className="rounded-lg border border-vx-sage/30 bg-vx-sage-bg/40 p-3 flex flex-wrap items-center gap-2">
          <p className="text-xs text-vx-text flex-1">{t("solve.wizard.resume.body")}</p>
          <button type="button" onClick={resume} className="px-3 py-1.5 text-xs font-semibold text-vx-sage border border-vx-sage/30 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage">
            {t("solve.wizard.resume.action")}
          </button>
          <button type="button" onClick={startOver} className="px-3 py-1.5 text-xs text-vx-muted hover:text-vx-text rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage">
            {t("solve.wizard.resume.discard")}
          </button>
        </div>
      )}

      {state.notice && (
        <p role="status" className="text-xs text-vx-amber">{t(`solve.wizard.notice.${state.notice}` as MessageKey, { minBond: formatAmount(minBond) })}</p>
      )}

      <nav aria-label={t("solve.wizard.progress")}>
        <ol className="flex flex-wrap gap-1.5">
          {WIZARD_STEPS.map((s, i) => {
            const reachable = i <= state.maxStep && state.step !== "done" && s !== "done";
            return (
              <li key={s}>
                <button
                  type="button"
                  aria-current={s === state.step ? "step" : undefined}
                  disabled={!reachable}
                  onClick={() => {
                    dispatch({ type: "goto", step: s });
                    update({ step: s === "eligibility" ? null : s }, "push");
                  }}
                  className={`px-2 py-1 rounded text-[11px] border focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage ${
                    s === state.step
                      ? "bg-vx-sage-bg text-vx-sage border-vx-sage/30"
                      : i < stepIdx
                        ? "text-vx-text border-vx-border"
                        : "text-vx-muted border-transparent"
                  } disabled:cursor-default`}
                >
                  <span className="num">{i + 1}.</span> {t(`solve.wizard.step.${s}` as MessageKey)}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section aria-labelledby="wizard-step-heading" className="space-y-4">
        <h3 id="wizard-step-heading" ref={stepHeadingRef} tabIndex={-1} className="text-sm font-semibold text-vx-text focus:outline-none">
          {t(`solve.wizard.step.${state.step}` as MessageKey)}
        </h3>

        {state.step === "eligibility" && (
          <EligibilityStep eligibility={eligibility} fundedStatus={funded.status} onRetryFunded={funded.check} onCancelFunded={funded.cancel} />
        )}
        {state.step === "verify" && (
          <VerifyStep state={state} walletAddress={walletAddress} error={stepError} onChange={(v) => dispatch({ type: "setAddress", value: v })} />
        )}
        {state.step === "bond" && (
          <BondStep state={state} error={stepError} onChange={(v) => dispatch({ type: "setBond", value: v })} />
        )}
        {state.step === "review" && (
          <div className="space-y-3">
            <dl className="bg-vx-surface/50 rounded-lg p-3 text-xs grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5">
              {summary.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="text-vx-muted">{row.label}</dt>
                  <dd className="num text-vx-text break-all text-right">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[11px] text-vx-muted">{t("solve.wizard.reviewHelp")}</p>
            {registration.status !== "idle" && registration.status !== "success" && (
              <SubmissionStepper
                status={stepperStatus}
                errorStep={errorStep === "idle" || errorStep === "success" || errorStep === "error" ? null : errorStep}
              />
            )}
            {registration.status === "error" && <p role="alert" className="text-xs text-red-400">{registration.error}</p>}
          </div>
        )}
        {state.step === "done" && (
          <div className="space-y-3">
            <p className="text-sm text-vx-sage">{t("solve.wizard.done.title")}</p>
            <ul className="list-disc pl-5 text-xs text-vx-muted space-y-1">
              <li>{t("solve.wizard.done.next1")}</li>
              <li>{t("solve.wizard.done.next2")}</li>
            </ul>
            <Link href={`/solve/${state.address}`} className="inline-block px-3 py-2 text-xs font-semibold text-vx-sage border border-vx-sage/30 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage">
              {t("solve.wizard.done.dashboard")}
            </Link>
          </div>
        )}

        {showErrors && stepError && state.step === "eligibility" && (
          <p role="alert" className="text-xs text-red-400">{stepError}</p>
        )}
      </section>

      {state.step !== "done" && (
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-vx-line">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIdx === 0 || busy}
            className="px-3 py-2 text-xs text-vx-muted hover:text-vx-text disabled:opacity-40 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
          >
            {t("solve.wizard.back")}
          </button>
          {state.step === "review" ? (
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              aria-busy={busy}
              className="px-4 py-2 bg-vx-sage-bg text-vx-sage text-xs font-semibold rounded-lg border border-vx-sage/30 hover:bg-vx-sage/15 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
            >
              {busy ? t("solve.wizard.submitting") : t("solve.wizard.submit")}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              aria-disabled={Boolean(stepErrorKey)}
              className="px-4 py-2 bg-vx-sage-bg text-vx-sage text-xs font-semibold rounded-lg border border-vx-sage/30 hover:bg-vx-sage/15 aria-disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
            >
              {t("solve.wizard.next")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
