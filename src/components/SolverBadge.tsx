/**
 * Displays a solver identifier with verification status.
 * Shows a visual indicator and warning message if the solver is not verified.
 */

interface SolverBadgeProps {
  solverAddress?: string | null;
  isVerified: boolean;
  displayName: string;
  showWarning?: boolean;
  className?: string;
}

export function SolverBadge({
  solverAddress,
  isVerified,
  displayName,
  showWarning = true,
  className = "",
}: SolverBadgeProps) {
  return (
    <div className={className}>
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${
          isVerified
            ? "bg-vx-sage-bg text-vx-sage"
            : "bg-amber-500/10 text-amber-400 border border-amber-400/30"
        }`}
      >
        {!isVerified && (
          <svg
            aria-hidden="true"
            className="w-3 h-3 flex-shrink-0"
            viewBox="0 0 12 12"
            fill="none"
          >
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1" />
            <path d="M6 3v4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            <circle cx="6" cy="9.5" r="0.5" fill="currentColor" />
          </svg>
        )}
        <span>{displayName}</span>
      </div>
      {!isVerified && showWarning && (
        <p className="text-[11px] text-amber-400/80 mt-1.5">
          This solver identity could not be verified against our registered solver list.{" "}
          {solverAddress && (
            <span className="font-mono text-[10px] block mt-0.5 break-all">{solverAddress}</span>
          )}
        </p>
      )}
    </div>
  );
}
