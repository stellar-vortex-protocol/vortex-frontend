'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * Shared modal Dialog primitive with a single focus-management implementation.
 *
 * Features:
 * - Focus trap with sentinel handling (Tab / Shift+Tab cycling).
 * - Initial focus on open and focus restoration to the previously focused
 *   element on close.
 * - Escape and outside-press dismissal with `stopPropagation` correctness so
 *   nested overlays only dismiss the top-most layer.
 * - `aria-modal`, portal rendering, scroll lock without layout shift and
 *   background `inert` handling.
 * - Reduced-motion aware transitions.
 *
 * The overlay stack is LIFO: only the most recently opened dialog reacts to
 * Escape / outside press, and focus is restored in reverse order.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (el) =>
      !el.hasAttribute('disabled') &&
      el.getAttribute('aria-hidden') !== 'true' &&
      (el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement),
  );
}

interface OverlayStackEntry {
  id: string;
  onEscape: () => void;
  onOutsidePress?: () => void;
  contains: (target: Node) => boolean;
}

interface OverlayStackContextValue {
  push: (entry: OverlayStackEntry) => void;
  remove: (id: string) => void;
  isTop: (id: string) => boolean;
}

const OverlayStackContext = createContext<OverlayStackContextValue | null>(null);

/**
 * Provides LIFO overlay stack management for nested dialogs/popovers.
 * Wrap the app (or the relevant subtree) once.
 */
export function OverlayStackProvider({ children }: { children: ReactNode }) {
  const stackRef = useRef<OverlayStackEntry[]>([]);

  const push = useCallback((entry: OverlayStackEntry) => {
    stackRef.current = [...stackRef.current.filter((e) => e.id !== entry.id), entry];
  }, []);

  const remove = useCallback((id: string) => {
    stackRef.current = stackRef.current.filter((e) => e.id !== id);
  }, []);

  const isTop = useCallback((id: string) => {
    const top = stackRef.current[stackRef.current.length - 1];
    return top?.id === id;
  }, []);

  const value = useMemo(() => ({ push, remove, isTop }), [push, remove, isTop]);

  return (
    <OverlayStackContext.Provider value={value}>
      {children}
    </OverlayStackContext.Provider>
  );
}

function useOverlayStack(): OverlayStackContextValue {
  const ctx = useContext(OverlayStackContext);
  // Fallback keeps the primitive usable without a provider (single overlay).
  const fallbackRef = useRef<OverlayStackEntry[]>([]);
  return useMemo<OverlayStackContextValue>(() => {
    if (ctx) return ctx;
    return {
      push: (entry) => {
        fallbackRef.current = [
          ...fallbackRef.current.filter((e) => e.id !== entry.id),
          entry,
        ];
      },
      remove: (id) => {
        fallbackRef.current = fallbackRef.current.filter((e) => e.id !== id);
      },
      isTop: (id) => {
        const top = fallbackRef.current[fallbackRef.current.length - 1];
        return top?.id === id;
      },
    };
  }, [ctx]);
}

let scrollLockCount = 0;
let previousOverflow = '';
let previousPaddingRight = '';

function lockScroll() {
  if (typeof document === 'undefined') return;
  if (scrollLockCount === 0) {
    const { body } = document;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    previousOverflow = body.style.overflow;
    previousPaddingRight = body.style.paddingRight;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  scrollLockCount += 1;
}

function unlockScroll() {
  if (typeof document === 'undefined') return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    const { body } = document;
    body.style.overflow = previousOverflow;
    body.style.paddingRight = previousPaddingRight;
  }
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Accessible label for the dialog. */
  'aria-label'?: string;
  /** Id of the element labelling the dialog. */
  'aria-labelledby'?: string;
  /** Id of the element describing the dialog. */
  'aria-describedby'?: string;
  /** Element to focus on open. Defaults to the first focusable child. */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Disable Escape dismissal (e.g. destructive confirmations). */
  disableEscape?: boolean;
  /** Disable outside-press dismissal. */
  disableOutsidePress?: boolean;
  className?: string;
  /** Optional backdrop class override. */
  backdropClassName?: string;
}

export function Dialog({
  open,
  onClose,
  children,
  initialFocusRef,
  disableEscape = false,
  disableOutsidePress = false,
  className,
  backdropClassName,
  ...aria
}: DialogProps) {
  const id = useId();
  const stack = useOverlayStack();
  const containerRef = useRef<HTMLDivElement>(null);
  const startSentinelRef = useRef<HTMLSpanElement>(null);
  const endSentinelRef = useRef<HTMLSpanElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleEscape = useCallback(() => {
    if (!disableEscape) onClose();
  }, [disableEscape, onClose]);

  const handleOutsidePress = useCallback(() => {
    if (!disableOutsidePress) onClose();
  }, [disableOutsidePress, onClose]);

  // Register in the overlay stack while open.
  useEffect(() => {
    if (!open) return;
    stack.push({
      id,
      onEscape: handleEscape,
      onOutsidePress: handleOutsidePress,
      contains: (target) => !!containerRef.current?.contains(target),
    });
    return () => stack.remove(id);
  }, [open, id, stack, handleEscape, handleOutsidePress]);

  // Scroll lock + background inert + initial/return focus.
  useEffect(() => {
    if (!open) return;
    lockScroll();

    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) ?? null;

    const container = containerRef.current;
    const target =
      initialFocusRef?.current ??
      (container ? getFocusable(container)[0] : null) ??
      container;
    target?.focus({ preventScroll: true });

    // Mark background siblings inert so screen readers / tab order skip them.
    const siblings: HTMLElement[] = [];
    const parent = container?.parentElement;
    if (parent) {
      Array.from(parent.children).forEach((child) => {
        if (child !== container && child instanceof HTMLElement) {
          siblings.push(child);
          child.setAttribute('inert', '');
          child.setAttribute('aria-hidden', 'true');
        }
      });
    }

    return () => {
      unlockScroll();
      siblings.forEach((el) => {
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
      });
      const previous = previouslyFocusedRef.current;
      if (previous && document.contains(previous)) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [open, initialFocusRef]);

  // Global keydown: Escape + Tab trapping, only for the top-most overlay.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!stack.isTop(id)) return;

      if (event.key === 'Escape') {
        event.stopPropagation();
        handleEscape();
        return;
      }

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
        if (active === first || active === startSentinelRef.current || !container.contains(active)) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else if (active === last || active === endSentinelRef.current) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, id, stack, handleEscape]);

  // Outside press: only the top-most overlay dismisses.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!stack.isTop(id)) return;
      const target = event.target as Node | null;
      if (target && containerRef.current?.contains(target)) return;
      event.stopPropagation();
      handleOutsidePress();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, id, stack, handleOutsidePress]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={backdropClassName ?? 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 motion-safe:animate-in motion-safe:fade-in'}
      data-dialog-backdrop=""
    >
      <span ref={startSentinelRef} tabIndex={0} aria-hidden="true" className="sr-only" />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={className ?? 'relative w-full max-w-lg rounded-lg bg-background p-6 shadow-lg outline-none'}
        {...aria}
      >
        {children}
      </div>
      <span ref={endSentinelRef} tabIndex={0} aria-hidden="true" className="sr-only" />
    </div>,
    document.body,
  );
}

export default Dialog;
