import type { IntentStatus } from "@/lib/types";

const STATUS_STYLES: Record<IntentStatus, string> = {
  pending: "bg-vx-lav-bg text-vx-lav border-vx-lav/60",
  accepted: "bg-blue-500/10 text-blue-300 border-blue-500/80",
  filled: "bg-vx-sage-bg text-vx-sage border-vx-sage/50",
  failed: "bg-red-500/10 text-red-300 border-red-500/80",
};

// Distinct icon shapes per status so the badge doesn't rely on color/background
// alone to differentiate — helps colorblind users tell statuses apart at a glance.
const STATUS_ICONS: Record<IntentStatus, JSX.Element> = {
  pending: (
    <circle
      cx="6"
      cy="6"
      r="4.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeDasharray="2 2"
      fill="none"
    />
  ),
  accepted: (
    <path
      d="M2.5 6l2.5 2.5L9.5 3.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  filled: (
    <path
      d="M2 6.5l2.5 2.5L10 3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  failed: (
    <path
      d="M3 3l6 6M9 3l-6 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
  ),
};

export function IntentStatusBadge({ status }: { status: IntentStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${STATUS_STYLES[status]}`}
    >
      <svg
        aria-hidden="true"
        className="w-2.5 h-2.5 flex-shrink-0"
        viewBox="0 0 12 12"
        fill="none"
      >
        {STATUS_ICONS[status]}
      </svg>
      {status}
    </span>
  );
}
