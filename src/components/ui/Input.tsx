import clsx from "clsx";
import { forwardRef, useId, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Marks the field as invalid: rose border plus `aria-invalid="true"`. */
  invalid?: boolean;
  /** Error message rendered below the field and linked via `aria-describedby`. */
  error?: string;
  /** Optional id for the error element; generated when omitted. */
  errorId?: string;
}

/**
 * Shared text input primitive. Uses logical padding (`ps-`/`pe-`) so the
 * field mirrors correctly in RTL documents.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, error, errorId, className, id, ...rest },
  ref,
) {
  const generatedErrorId = useId();
  const resolvedErrorId = errorId ?? `${id ?? generatedErrorId}-error`;
  const hasError = Boolean(error);
  const isInvalid = invalid || hasError;

  return (
    <>
      <input
        ref={ref}
        id={id}
        aria-invalid={isInvalid || undefined}
        aria-describedby={hasError ? resolvedErrorId : undefined}
        className={clsx(
          "w-full ps-3 pe-3 py-2 text-sm bg-vx-surface text-vx-text placeholder:text-vx-muted rounded-lg border focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage disabled:opacity-60 disabled:cursor-not-allowed",
          isInvalid ? "border-vx-rose" : "border-vx-border",
          className,
        )}
        {...rest}
      />
      {hasError ? (
        <p id={resolvedErrorId} className="mt-1 text-sm text-vx-rose">
          {error}
        </p>
      ) : null}
    </>
  );
});
