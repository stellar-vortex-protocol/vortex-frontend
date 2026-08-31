import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  "button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

type UseDismissableOverlayOptions = {
  isOpen: boolean;
  onClose: () => void;
  /** The button that opens the overlay; focus returns here on close. */
  triggerRef: React.RefObject<HTMLElement>;
};

/**
 * Shared overlay dismissal behavior: closes on Escape (returning focus to the
 * trigger), closes on outside click/tap, and traps Tab focus within the
 * overlay while it's open. Used by the chain picker, mobile nav, and
 * settings dropdown so the three don't reimplement the same logic.
 */
export function useDismissableOverlay<T extends HTMLElement>({
  isOpen,
  onClose,
  triggerRef,
}: UseDismissableOverlayOptions) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!isOpen) return;

    containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Ignore clicks on the trigger itself: its own onClick already toggles
    // the overlay, so also closing it here would immediately reopen it.
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen, onClose, triggerRef]);

  return containerRef;
}
