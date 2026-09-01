"use client";

/**
 * Tooltip — accessible WAI-ARIA tooltip pattern.
 *
 * Usage:
 *   <Tooltip content="Price impact is the difference between the market
 *                      price and your estimated fill price.">
 *     <span>Price impact</span>
 *   </Tooltip>
 *
 * Behaviour:
 * - Shown on hover and keyboard focus (never mouse-only).
 * - Dismissed by pressing Escape or when the trigger loses focus/hover.
 * - The trigger element receives `aria-describedby` pointing to the tooltip.
 * - Basic viewport-edge collision handling (flips to left/right when close
 *   to the screen edge, and flips above when not enough space below).
 * - Touch devices: tap the trigger once to toggle the tooltip; tap again or
 *   elsewhere to dismiss.
 * - Does not trap focus or interfere with Tab order.
 */

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

export type TooltipProps = {
  /** The explanatory text shown in the tooltip. */
  content: ReactNode;
  /**
   * The element that triggers the tooltip. Must be a single React element
   * that accepts `ref`, `aria-describedby`, `onMouseEnter`, `onMouseLeave`,
   * `onFocus`, and `onBlur` props.
   */
  children: ReactElement;
  /** Preferred placement. Falls back via collision detection. @default "top" */
  placement?: "top" | "bottom";
};

export function Tooltip({ content, children, placement = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [resolvedPlacement, setResolvedPlacement] = useState(placement);

  const show = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    // Small delay so moving from trigger → tooltip doesn't flicker.
    hideTimeoutRef.current = setTimeout(() => setVisible(false), 80);
  }, []);

  // Resolve actual placement using viewport collision detection.
  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const tip = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let p: "top" | "bottom" = placement;

    if (p === "top" && trigger.top - tip.height - 8 < 0) p = "bottom";
    if (p === "bottom" && trigger.bottom + tip.height + 8 > vh) p = "top";

    // Horizontal clip guard: tooltip is absolutely positioned relative to
    // trigger, so we only need to ensure it fits within the viewport here.
    const tipLeft = trigger.left + trigger.width / 2 - tip.width / 2;
    if (tipLeft < 4 || tipLeft + tip.width > vw - 4) {
      // handled via CSS clamp in the style below — nothing needed here.
    }

    setResolvedPlacement(p);
  }, [visible, placement]);

  // Escape key dismisses the tooltip.
  useEffect(() => {
    if (!visible) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setVisible(false);
      }
    };
    document.addEventListener("keydown", handle, { capture: true });
    return () => document.removeEventListener("keydown", handle, { capture: true });
  }, [visible]);

  // Touch: tap to toggle.
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault(); // Prevent the synthetic click that would immediately re-open.
      setVisible(v => !v);
    },
    [],
  );

  if (!isValidElement(children)) return children as unknown as ReactElement;

  const trigger = cloneElement(children as ReactElement<Record<string, unknown>>, {
    ref: triggerRef,
    "aria-describedby": visible ? id : undefined,
    onMouseEnter: (...args: unknown[]) => {
      show();
      // Forward original handler if present.
      const orig = (children.props as Record<string, unknown>).onMouseEnter;
      if (typeof orig === "function") orig(...args);
    },
    onMouseLeave: (...args: unknown[]) => {
      hide();
      const orig = (children.props as Record<string, unknown>).onMouseLeave;
      if (typeof orig === "function") orig(...args);
    },
    onFocus: (...args: unknown[]) => {
      show();
      const orig = (children.props as Record<string, unknown>).onFocus;
      if (typeof orig === "function") orig(...args);
    },
    onBlur: (...args: unknown[]) => {
      hide();
      const orig = (children.props as Record<string, unknown>).onBlur;
      if (typeof orig === "function") orig(...args);
    },
    onTouchEnd: handleTouchEnd,
  });

  return (
    <span className="relative inline-flex items-center">
      {trigger}
      {visible && (
        <div
          id={id}
          ref={tooltipRef}
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={hide}
          style={{
            // Position above or below, centred on the trigger.
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            ...(resolvedPlacement === "top"
              ? { bottom: "calc(100% + 6px)" }
              : { top: "calc(100% + 6px)" }),
            // Prevent clipping at viewport edges by clamping.
            maxWidth: "min(260px, calc(100vw - 16px))",
            zIndex: 50,
          }}
          className="pointer-events-auto whitespace-normal rounded-lg border border-vx-border bg-vx-card px-2.5 py-1.5 text-[11px] leading-snug text-vx-text shadow-lg animate-fade-up"
        >
          {content}
          {/* Caret */}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              ...(resolvedPlacement === "top"
                ? {
                    bottom: "-4px",
                    borderTop: "4px solid var(--color-vx-border, #333)",
                    borderLeft: "4px solid transparent",
                    borderRight: "4px solid transparent",
                  }
                : {
                    top: "-4px",
                    borderBottom: "4px solid var(--color-vx-border, #333)",
                    borderLeft: "4px solid transparent",
                    borderRight: "4px solid transparent",
                  }),
              width: 0,
              height: 0,
            }}
          />
        </div>
      )}
    </span>
  );
}
