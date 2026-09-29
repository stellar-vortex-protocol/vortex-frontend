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

const STATUS_LABELS: Record<IntentStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  success: 'Success',
  error: 'Error',
  cancelled: 'Cancelled',
};

/**
 * Status badge that conveys state through an icon and text label in addition
 * to colour, so it remains legible in forced-colors / high-contrast modes.
 * The processing indicator is only animated when motion is allowed.
 */
export function IntentStatusBadge({
  status,
  label,
  className = '',
}: IntentStatusBadgeProps) {
  const { prefersReducedMotion } = useMotionPreference();

  const text = label ?? STATUS_LABELS[status];
  const icon = STATUS_ICONS[status];

  const iconClassName = useMemo(() => {
    if (status !== 'processing' || prefersReducedMotion) {
      return 'inline-block';
    }
    return 'inline-block motion-safe:animate-spin';
  }, [status, prefersReducedMotion]);

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
      <span aria-hidden="true" className={iconClassName}>
        {icon}
      </span>
      <span>{text}</span>
    </span>
  );
}

export default IntentStatusBadge;
