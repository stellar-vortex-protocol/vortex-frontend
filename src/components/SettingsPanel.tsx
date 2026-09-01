"use client";

import { useEffect, useRef, useState } from "react";
import { LOCALES, type Locale } from "@/lib/i18n";
import { useLocale, useSetLocale } from "@/lib/i18n/I18nProvider";

type MotionPreference = "system" | "reduce" | "allow";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

const STORAGE_KEY = "vortex-motion-preference";

function applyMotionPreference(preference: MotionPreference) {
  document.documentElement.dataset.motion = preference;
}

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [motionPreference, setMotionPreference] = useState<MotionPreference>("system");
  const locale = useLocale();
  const setLocale = useSetLocale();

  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const preference = stored === "reduce" || stored === "allow" ? stored : "system";
    setMotionPreference(preference);
    applyMotionPreference(preference);
  }, []);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (!open) return;
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      "select, button, input, [tabindex]:not([tabindex='-1'])"
    );
    firstFocusable?.focus();
  }, [open]);

  const closePanel = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  // Trap Tab focus inside panel; Escape closes it.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closePanel();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      "select, button, input, [tabindex]:not([tabindex='-1'])"
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleMotionChange = (preference: MotionPreference) => {
    setMotionPreference(preference);
    applyMotionPreference(preference);
    if (preference === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, preference);
    }
  };

  return (
    <div className="relative">
      <button
        ref={toggleRef}
        type="button"
        onClick={() => (open ? closePanel() : setOpen(true))}
        aria-expanded={open}
        aria-controls="settings-panel"
        aria-haspopup="dialog"
        className="px-3 py-1.5 text-xs rounded-lg border border-vx-border text-vx-muted hover:text-vx-text hover:border-vx-sage/50 transition-colors"
      >
        Settings
      </button>

      {open && (
        <div
          ref={panelRef}
          id="settings-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
          onKeyDown={handleKeyDown}
          className="absolute right-0 mt-2 w-64 rounded-xl border border-vx-border bg-vx-card p-4 shadow-xl z-50"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="settings-locale-switcher" className="block text-xs font-medium text-vx-muted">
                Language
              </label>
              <select
                id="settings-locale-switcher"
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                aria-label="Switch language"
                className="mt-1 w-full bg-vx-surface border border-vx-border rounded-md px-2 py-1 text-sm text-vx-text"
              >
                {LOCALES.map((loc) => (
                  <option key={loc} value={loc} className="bg-vx-ink text-vx-text">
                    {LOCALE_LABELS[loc]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="motion-preference" className="block text-xs font-medium text-vx-muted">
                Motion
              </label>
              <select
                id="motion-preference"
                value={motionPreference}
                onChange={(e) => handleMotionChange(e.target.value as MotionPreference)}
                aria-label="Motion preference"
                className="mt-1 w-full bg-vx-surface border border-vx-border rounded-md px-2 py-1 text-sm text-vx-text"
              >
                <option value="system" className="bg-vx-ink text-vx-text">Use system setting</option>
                <option value="reduce" className="bg-vx-ink text-vx-text">Reduce motion</option>
                <option value="allow" className="bg-vx-ink text-vx-text">Allow motion</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
