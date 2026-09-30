'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * Shared overlay primitives (issue #489).
 *
 * A single focus-management implementation backs every overlay in the app:
 * focus trap with sentinel handling, initial/return focus, Escape and
 * outside-press dismissal with `stopPropagation` correctness for nested
 * overlays, `aria-modal`, scroll lock without layout shift, background
 * `inert`, portal rendering and reduced-motion transitions.
 *
 * `Dialog` is the modal variant; `Popover` is the non-modal anchored variant
 * with lightweight collision-aware positioning. `Menu`/`Listbox` helpers are
 * built on top of `Popover`.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null,
  );
}

/* -------------------------------------------------------------------------- */
/* Overlay stack                                                              */
/* -------------------------------------------------------------------------- */

type OverlayEntry = {
  id: string;
  dismiss: (reason: 'escape' | 'outside-press') => void;
};

const overlayStack: OverlayEntry[] = [];

function pushOverlay(entry: OverlayEntry) {
  overlayStack.push(entry);
}

function removeOverlay(id: string) {
  const index = overlayStack.findIndex((entry) => entry.id === id);
  if (index !== -1) overlayStack.splice(index, 1);
}

function topOverlay(): OverlayEntry | undefined {
  return overlayStack[overlayStack.length - 1];
}

/* -------------------------------------------------------------------------- */
/* Scroll lock (no layout shift)                                              */
/* -------------------------------------------------------------------------- */

let scrollLockCount = 0;
let previousOverflow = '';
let previousPaddingRight = '';

function lockScroll() {
  if (typeof document === 'undefined') return;
  scrollLockCount += 1;
  if (scrollLockCount > 1) return;
  const { body, documentElement } = document;
  const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
  previousOverflow = body.style.overflow;
  previousPaddingRight = body.style.paddingRight;
  body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`;
  }
}

function unlockScroll() {
  if (typeof document === 'undefined') return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount > 0) return;
  const { body } = document;
  body.style.overflow = previousOverflow;
  body.style.paddingRight = previousPaddingRight;
}

/* -------------------------------------------------------------------------- */
/* Background inert                                                           */
/* -------------------------------------------------------------------------- */

function setBackgroundInert(active: boolean) {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('__next') ?? document.body;
  const children = Array.from(root.children) as HTMLElement[];
  for (const child of children) {
    if (child.dataset.overlayRoot === 'true') continue;
    if (active) {
      if (!child.hasAttribute('inert')) {
        child.setAttribute('inert', '');
        child.dataset.overlayInert = 'true';
      }
    } else if (child.dataset.overlayInert === 'true') {
      child.removeAttribute('inert');
      delete child.dataset.overlayInert;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Shared overlay behaviour                                                   */
/* -------------------------------------------------------------------------- */

type OverlayBehaviourOptions = {
  open: boolean;
  modal: boolean;
  onDismiss?: (reason: 'escape' | 'outside-press') => void;
  containerRef: React.RefObject<HTMLElement | null>;
  anchorRef?: React.RefObject<HTMLElement | null>;
};

function useOverlayBehaviour({ open, modal, onDismiss, containerRef, anchorRef }: OverlayBehaviourOptions) {
  const id = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Initial focus + return focus (LIFO via the overlay stack).
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
    const container = containerRef.current;
    const focusable = getFocusable(container);
    const target = focusable[0] ?? container;
    target?.focus({ preventScroll: true });
    return () => {
      const toRestore = previouslyFocused.current;
      previouslyFocused.current = null;
      if (toRestore && document.contains(toRestore)) {
        toRestore.focus({ preventScroll: true });
      }
    };
  }, [open, containerRef]);

  // Escape + outside-press dismissal, only for the top-most overlay.
  useEffect(() => {
    if (!open || !onDismiss) return;
    const entry: OverlayEntry = { id, dismiss: onDismiss };
    pushOverlay(entry);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (topOverlay()?.id !== id) return;
      event.stopPropagation();
      onDismiss('escape');
    };

    const onPointerDown = (event: PointerEvent) => {
      if (topOverlay()?.id !== id) return;
      const target = event.target as Node | null;
      if (containerRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      event.stopPropagation();
      onDismiss('outside-press');
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      removeOverlay(id);
    };
  }, [open, onDismiss, id, containerRef, anchorRef]);

  // Focus trap with sentinel handling (modal only).
  useEffect(() => {
    if (!open || !modal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container) return;
      const focusable = getFocusable(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else if (active === last || !container.contains(active)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, modal, containerRef]);

  // Scroll lock + background inert (modal only).
  useEffect(() => {
    if (!open || !modal) return;
    lockScroll();
    setBackgroundInert(true);
    return () => {
      setBackgroundInert(false);
      unlockScroll();
    };
  }, [open, modal]);
}

/* -------------------------------------------------------------------------- */
/* Portal                                                                     */
/* -------------------------------------------------------------------------- */

function OverlayPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(
    <div data-overlay-root="true" className="contents">
      {children}
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/* Dialog (modal)                                                             */
/* -------------------------------------------------------------------------- */

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
};

export function Dialog({ open, onClose, title, children, className, labelledBy }: DialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const handleDismiss = useCallback(() => onClose(), [onClose]);

  useOverlayBehaviour({ open, modal: true, onDismiss: handleDismiss, containerRef });

  if (!open) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 motion-safe:animate-[fadeIn_150ms_ease-out]" aria-hidden="true" />
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy ?? (title ? titleId : undefined)}
          tabIndex={-1}
          className={className ?? 'relative z-10 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900'}
        >
          {title ? (
            <h2 id={titleId} className="mb-4 text-lg font-semibold">
              {title}
            </h2>
          ) : null}
          {children}
        </div>
      </div>
    </OverlayPortal>
  );
}

/* -------------------------------------------------------------------------- */
/* Popover (non-modal, anchored, collision-aware)                             */
/* -------------------------------------------------------------------------- */

type Placement = 'top' | 'bottom' | 'left' | 'right';

type PopoverProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  placement?: Placement;
  offset?: number;
  children: ReactNode;
  className?: string;
  role?: 'dialog' | 'menu' | 'listbox';
  labelledBy?: string;
};

function computePosition(
  anchor: HTMLElement,
  popover: HTMLElement,
  placement: Placement,
  offset: number,
): CSSProperties {
  const anchorRect = anchor.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let resolved: Placement = placement;
  if (placement === 'bottom' && anchorRect.bottom + popoverRect.height + offset > viewportHeight) {
    resolved = 'top';
  } else if (placement === 'top' && anchorRect.top - popoverRect.height - offset < 0) {
    resolved = 'bottom';
  } else if (placement === 'right' && anchorRect.right + popoverRect.width + offset > viewportWidth) {
    resolved = 'left';
  } else if (placement === 'left' && anchorRect.left - popoverRect.width - offset < 0) {
    resolved = 'right';
  }

  let top = 0;
  let left = 0;
  switch (resolved) {
    case 'top':
      top = anchorRect.top - popoverRect.height - offset;
      left = anchorRect.left + anchorRect.width / 2 - popoverRect.width / 2;
      break;
    case 'left':
      top = anchorRect.top + anchorRect.height / 2 - popoverRect.height / 2;
      left = anchorRect.left - popoverRect.width - offset;
      break;
    case 'right':
      top = anchorRect.top + anchorRect.height / 2 - popoverRect.height / 2;
      left = anchorRect.right + offset;
      break;
    case 'bottom':
    default:
      top = anchorRect.bottom + offset;
      left = anchorRect.left + anchorRect.width / 2 - popoverRect.width / 2;
      break;
  }

  // Clamp to viewport so the popover never overflows the edges.
  left = Math.max(8, Math.min(left, viewportWidth - popoverRect.width - 8));
  top = Math.max(8, Math.min(top, viewportHeight - popoverRect.height - 8));

  return { position: 'fixed', top, left };
}

export function Popover({
  open,
  onClose,
  anchorRef,
  placement = 'bottom',
  offset = 8,
  children,
  className,
  role = 'dialog',
  labelledBy,
}: PopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', top: 0, left: 0, visibility: 'hidden' });
  const handleDismiss = useCallback(() => onClose(), [onClose]);

  useOverlayBehaviour({ open, modal: false, onDismiss: handleDismiss, containerRef, anchorRef });

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const popover = containerRef.current;
    if (!anchor || !popover) return;
    setStyle({ ...computePosition(anchor, popover, placement, offset), visibility: 'visible' });
  }, [anchorRef, placement, offset]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, reposition]);

  if (!open) return null;

  return (
    <OverlayPortal>
      <div
        ref={containerRef}
        role={role}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={style}
        className={
          className ??
          'z-50 rounded-md border border-neutral-200 bg-white p-2 shadow-lg motion-safe:animate-[fadeIn_120ms_ease-out] dark:border-neutral-700 dark:bg-neutral-900'
        }
      >
        {children}
      </div>
    </OverlayPortal>
  );
}

/* -------------------------------------------------------------------------- */
/* Menu / Listbox helpers                                                     */
/* -------------------------------------------------------------------------- */

type MenuProps = Omit<PopoverProps, 'role'> & { labelledBy: string };

export function Menu(props: MenuProps) {
  return <Popover {...props} role="menu" />;
}

export function Listbox(props: MenuProps) {
  return <Popover {...props} role="listbox" />;
}

/* -------------------------------------------------------------------------- */
/* useDismissableOverlay (reimplemented on top of the primitives)             */
/* -------------------------------------------------------------------------- */

type DismissableOverlayOptions = {
  open: boolean;
  onDismiss: () => void;
  containerRef: React.RefObject<HTMLElement | null>;
  anchorRef?: React.RefObject<HTMLElement | null>;
  modal?: boolean;
};

/**
 * Backwards-compatible hook used by existing overlays. It now delegates to the
 * shared overlay behaviour so every consumer shares one focus-management
 * implementation (issue #489).
 */
export function useDismissableOverlay({
  open,
  onDismiss,
  containerRef,
  anchorRef,
  modal = false,
}: DismissableOverlayOptions) {
  const handleDismiss = useCallback(() => onDismiss(), [onDismiss]);
  useOverlayBehaviour({ open, modal, onDismiss: handleDismiss, containerRef, anchorRef });
}

/* -------------------------------------------------------------------------- */
/* Context for consumers that need to know whether an overlay is open         */
/* -------------------------------------------------------------------------- */

type OverlayContextValue = { open: boolean };
const OverlayContext = createContext<OverlayContextValue>({ open: false });

export function OverlayProvider({ open, children }: { open: boolean; children: ReactNode }) {
  const value = useMemo(() => ({ open }), [open]);
  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlayOpen() {
  return useContext(OverlayContext).open;
}
