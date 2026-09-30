'use client';

import { useMemo } from 'react';
import { useMotionPreference } from '@/lib/useMotionPreference';

export type IntentStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'error'
  | 'cancelled';

interface IntentStatusBadgeProps {
  status: IntentStatus;
  label?: string;
  className?: string;
}

const STATUS_STYLES: Record<IntentStatus, string> = {
  pending:
    'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  processing:
    'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  success:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  error:
    'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  cancelled:
    'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300',
};

const STATUS_ICONS: Record<IntentStatus, string> = {
  pending: '\u25CB',
  processing: '\u25D4',
  success: '\u2713',
  error: '\u2715',
  cancelled: '\u2298',
};

      <span aria-hidden="true" className={iconClassName}>
        {icon}
      </span>

  return (
    <span
      role="status"
      aria-label={text}
      data-status={status}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        'forced-colors:border-[CanvasText] forced-colors:text-[CanvasText]',
        STATUS_STYLES[status],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <svg
        aria-hidden="true"
        className="w-2.5 h-2.5 flex-shrink-0"
        viewBox="0 0 12 12"
        fill="none"
      >
        {STATUS_ICONS[status]}
      </svg>
      {status}{verified && <span aria-label="verified on chain" title="Verified on chain">✓ verified</span>}
    </span>
  );
}

export default IntentStatusBadge;
