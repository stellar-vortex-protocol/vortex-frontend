import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";

const STEP_ORDER = ["connecting", "building", "awaiting-signature", "submitting"] as const;
type StepId = (typeof STEP_ORDER)[number];
// "reviewing" (the transaction review before signing) is shown as the Sign step.
type InFlightStatus = StepId | "reviewing";
export type SubmissionStatus = "idle" | InFlightStatus | "success" | "error";

function stepOf(status: InFlightStatus): StepId {
  return status === "reviewing" ? "awaiting-signature" : status;
}

const STEP_LABEL_KEY: Record<StepId, MessageKey> = {
  connecting: "stepper.step.connecting",
  building: "stepper.step.building",
  "awaiting-signature": "stepper.step.signing",
  submitting: "stepper.step.submitting",
};

export type SubmissionStepperProps = {
  status: SubmissionStatus;
  /** The step that was active when an error occurred, for the "error" status. */
  errorStep?: InFlightStatus | null;
};

/**
 * Visual stepper for hooks with the connecting → building → awaiting-signature
 * → submitting → success/error state shape (useSwapSubmission,
 * useSolverRegistration). Renders nothing at rest ("idle").
 */
export function SubmissionStepper({ status, errorStep }: SubmissionStepperProps) {
  const { t } = useTranslation();
  if (status === "idle") return null;

  const activeIndex =
    status === "success"
      ? STEP_ORDER.length
      : status === "error"
        ? STEP_ORDER.indexOf(errorStep ? stepOf(errorStep) : "submitting")
        : STEP_ORDER.indexOf(stepOf(status));

  return (
    <ol className="flex items-start gap-2" aria-label={t("stepper.aria")}>
      {STEP_ORDER.map((step, index) => {
        const isCurrent = status !== "success" && status !== "error" && index === activeIndex;
        const isErrored = status === "error" && index === activeIndex;
        const isComplete = status === "success" || (index < activeIndex && !isErrored);
        const isAwaitingSignature = step === "awaiting-signature" && isCurrent;

        return (
          <li
            key={step}
            className="flex-1 flex flex-col items-center gap-1.5"
            aria-current={isCurrent || isErrored ? "step" : undefined}
          >
            <div
              aria-hidden="true"
              className={`w-full h-1.5 rounded-full transition-colors ${
                isErrored
                  ? "bg-red-400"
                  : isComplete
                    ? "bg-vx-sage"
                    : isCurrent
                      ? "bg-vx-sage/60 animate-pulse"
                      : "bg-vx-line"
              }`}
            />
            <span
              className={`text-[10px] font-medium text-center ${
                isErrored ? "text-red-400" : isCurrent || isComplete ? "text-vx-text" : "text-vx-dim"
              }`}
            >
              {t(STEP_LABEL_KEY[step])}
            </span>
            {isAwaitingSignature && (
              <span className="text-[10px] text-vx-sage text-center leading-tight">
                {t("stepper.checkWallet")}
              </span>
            )}
            {isErrored && (
              <span className="sr-only">{t("stepper.failedHere")}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
