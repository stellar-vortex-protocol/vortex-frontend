"use client";

import { useEffect } from "react";
import { SubmissionStepper, type SubmissionStatus } from "@/components/SubmissionStepper";
import { useSolvers } from "@/hooks/useSolvers";
import { useSolverRegistration, type SolverRegistrationStatus } from "@/hooks/useSolverRegistration";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import { useWalletStore } from "@/store/wallet";
import { SolverOnboardingChecklist } from "./SolverOnboardingChecklist";
import { useRegistrationForm } from "./useRegistrationForm";

const BUSY_LABEL: Partial<Record<SolverRegistrationStatus, MessageKey>> = {
  connecting: "solve.register.states.connecting",
  building: "solve.register.states.building",
  reviewing: "solve.register.states.building",
  "awaiting-signature": "solve.register.states.awaitingSignature",
  submitting: "solve.register.states.submitting",
};

// The stepper has no dedicated review step; XDR review happens within "build".
function toStepperStatus(status: SolverRegistrationStatus): SubmissionStatus {
  return status === "reviewing" ? "building" : status;
}

type StepperStep = NonNullable<React.ComponentProps<typeof SubmissionStepper>["errorStep"]>;

function toStepperStep(step: SolverRegistrationStatus | null): StepperStep | null {
  const mapped = step ? toStepperStatus(step) : null;
  return mapped === null || mapped === "idle" || mapped === "success" || mapped === "error" ? null : mapped;
}

const INPUT_CLASS =
  "w-full bg-vx-surface border border-vx-border rounded-lg px-3 py-2.5 text-sm text-vx-text placeholder-vx-dim/60 focus:outline-none focus:ring-2 focus:ring-vx-sage focus:border-vx-sage/50 transition-colors";

export function RegisterSolverTab() {
  const { t } = useTranslation();
  const form = useRegistrationForm();
  const { solvers } = useSolvers();
  const registration = useSolverRegistration();
  const networkMismatch = useWalletStore((s) => s.networkMismatch);

  const busyLabel = BUSY_LABEL[registration.status];
  const alreadyRegistered = Boolean(
    form.address && solvers.some((s) => s.address.toLowerCase() === form.address.toLowerCase()),
  );

  const { reset: resetForm } = form;
  useEffect(() => {
    if (registration.status === "success") resetForm();
  }, [registration.status, resetForm]);

  const onSubmit = async () => {
    if (registration.status === "success") {
      registration.reset();
      return;
    }
    form.markSubmitted();
    if (!form.isValid || networkMismatch) return;
    await registration.register(form.address, Number(form.bond));
  };

  return (
    <div className="max-w-xl space-y-6">
      <SolverOnboardingChecklist alreadyRegistered={alreadyRegistered} />

      <div className="card p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div>
          <h3 className="text-base font-semibold text-vx-text mb-1">{t("solve.register.title")}</h3>
          <p className="text-xs text-vx-muted">{t("solve.register.description")}</p>
        </div>

        <div>
          <label htmlFor="solver-address" className="eyebrow block mb-2 text-xs">
            {t("solve.register.addressLabel")}
          </label>
          <input
            id="solver-address"
            type="text"
            value={form.address}
            onChange={(e) => form.setAddress(e.target.value.trim())}
            placeholder={t("solve.register.addressPlaceholder")}
            aria-invalid={Boolean(form.addressError)}
            aria-describedby={form.addressError ? "solver-address-error" : undefined}
            className={INPUT_CLASS}
          />
          {form.addressError && (
            <p id="solver-address-error" role="alert" className="text-xs text-red-400 mt-1.5">
              {form.addressError}
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
            inputMode="decimal"
            value={form.bond}
            onChange={(e) => form.setBond(e.target.value)}
            placeholder={t("solve.register.bondPlaceholder")}
            aria-invalid={Boolean(form.bondError)}
            aria-describedby={form.bondError ? "solver-bond-error" : undefined}
            className={INPUT_CLASS}
          />
          {form.bondError && (
            <p id="solver-bond-error" role="alert" className="text-xs text-red-400 mt-1.5">
              {form.bondError}
            </p>
          )}
        </div>

        <div className="bg-vx-surface/50 rounded-lg p-3 text-xs text-vx-muted space-y-1">
          <div>{t("solve.register.info.minimumBond")}</div>
          <div>{t("solve.register.info.slash")}</div>
          <div>{t("solve.register.info.withdraw")}</div>
        </div>

        {registration.status !== "idle" && registration.status !== "success" && (
          <SubmissionStepper status={toStepperStatus(registration.status)} errorStep={toStepperStep(registration.errorStep)} />
        )}

        {registration.status === "error" && (
          <p role="alert" className="text-xs text-red-400">
            {registration.error}
          </p>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={Boolean(busyLabel) || networkMismatch}
          aria-busy={Boolean(busyLabel)}
          className="w-full py-2.5 bg-vx-sage-bg text-vx-sage text-xs font-semibold rounded-lg border border-vx-sage/30 hover:bg-vx-sage/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {busyLabel
            ? t(busyLabel)
            : registration.status === "success"
              ? t("solve.register.button.registered")
              : t("solve.register.button.connect")}
        </button>
      </div>
    </div>
  );
}
