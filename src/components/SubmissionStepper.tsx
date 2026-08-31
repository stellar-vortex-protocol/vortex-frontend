const STEP_ORDER = ["connecting", "building", "awaiting-signature", "submitting"] as const;
type StepId = (typeof STEP_ORDER)[number];
export type SubmissionStatus = "idle" | StepId | "success" | "error";

const STEP_LABELS: Record<StepId, string> = {
  connecting: "Connect",
  building: "Build",
  "awaiting-signature": "Sign",
  submitting: "Submit",
};

export type SubmissionStepperProps = {
  status: SubmissionStatus;
  /** The step that was active when an error occurred, for the "error" status. */
  errorStep?: StepId | null;
};

/**
 * Visual stepper for hooks with the connecting → building → awaiting-signature
 * → submitting → success/error state shape (useSwapSubmission,
 * useSolverRegistration). Renders nothing at rest ("idle").
 */
export function SubmissionStepper({ status, errorStep }: SubmissionStepperProps) {
  if (status === "idle") return null;

  const activeIndex =
    status === "success"
      ? STEP_ORDER.length
      : status === "error"
        ? STEP_ORDER.indexOf(errorStep ?? STEP_ORDER[STEP_ORDER.length - 1])
        : STEP_ORDER.indexOf(status);

  return (
    <ol className="flex items-start gap-2" aria-label="Submission progress">
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
              {STEP_LABELS[step]}
            </span>
            {isAwaitingSignature && (
              <span className="text-[10px] text-vx-sage text-center leading-tight">
                Check your wallet extension
              </span>
            )}
            {isErrored && (
              <span className="sr-only">Failed at this step</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
