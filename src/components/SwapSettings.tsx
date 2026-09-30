"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useDismissableOverlay } from "@/hooks/useDismissableOverlay";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import {
  DEADLINE_PRESETS_MIN,
  SLIPPAGE_PRESETS,
  getSlippageStatus,
  parseSlippageInput,
  type SlippageStatus,
} from "@/lib/slippage";
import { useSwapSettingsStore } from "@/store/swapSettings";

const STATUS_MESSAGE_KEY: Partial<Record<SlippageStatus, MessageKey>> = {
  low: "swap.slippage.lowWarning",
  high: "swap.slippage.highWarning",
  invalid: "swap.slippage.invalid",
};

const isPreset = (pct: number) => (SLIPPAGE_PRESETS as readonly number[]).includes(pct);

const chipClass = (active: boolean, tone: "default" | "warn" = "default") =>
  `px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-vx-sage/60 ${
    active
      ? tone === "warn"
        ? "border-amber-400/60 bg-amber-400/10 text-amber-400"
        : "border-vx-sage/50 bg-vx-sage/10 text-vx-sage"
      : "border-vx-border text-vx-muted hover:text-vx-text"
  }`;

/**
 * Gear-button popover for slippage tolerance (presets + validated custom
 * value) and intent deadline. Values persist via `useSwapSettingsStore`;
 * only valid slippage values are ever committed to the store.
 */
export function SwapSettings() {
  const { t } = useTranslation();
  const { slippagePct, deadlineMin, setSlippagePct, setDeadlineMin, resetToDefaults } =
    useSwapSettingsStore();
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(() => !isPreset(slippagePct));
  const [customText, setCustomText] = useState(() => (isPreset(slippagePct) ? "" : String(slippagePct)));

  const triggerRef = useRef<HTMLButtonElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const panelRef = useDismissableOverlay<HTMLDivElement>({ isOpen: open, onClose: close, triggerRef });
  const baseId = useId();

  const customValue = parseSlippageInput(customText);
  const status: SlippageStatus =
    customMode && customText !== "" ? getSlippageStatus(customValue) : getSlippageStatus(slippagePct);
  const statusKey = STATUS_MESSAGE_KEY[status];
  const messageId = `${baseId}-slippage-msg`;
  const triggerWarn = getSlippageStatus(slippagePct) !== "ok";

  const handleCustomChange = (raw: string) => {
    setCustomMode(true);
    setCustomText(raw);
    const parsed = parseSlippageInput(raw);
    if (getSlippageStatus(parsed) !== "invalid") setSlippagePct(parsed);
  };

  const handleReset = () => {
    resetToDefaults();
    setCustomMode(false);
    setCustomText("");
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("swap.settings.open")}
        className={`num text-[10px] px-2 py-1 rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage/60 ${
          triggerWarn ? "border-amber-400/60 text-amber-400" : "border-vx-border text-vx-muted hover:text-vx-text"
        }`}
      >
        <span aria-hidden="true">⚙ </span>
        {t("swap.settings.summary", { percent: slippagePct, minutes: deadlineMin })}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t("swap.settings.title")}
          className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-vx-border bg-vx-surface p-4 space-y-4 shadow-xl"
        >
          <fieldset className="space-y-2">
            <legend className="eyebrow mb-2">{t("swap.slippage.label")}</legend>
            <div className="flex flex-wrap gap-2">
              {SLIPPAGE_PRESETS.map(preset => {
                const active = !customMode && slippagePct === preset;
                return (
                  <label key={preset} className={chipClass(active)}>
                    <input
                      type="radio"
                      name={`${baseId}-slippage`}
                      className="sr-only"
                      checked={active}
                      onChange={() => {
                        setCustomMode(false);
                        setSlippagePct(preset);
                      }}
                    />
                    {preset}%
                  </label>
                );
              })}
              <label className={chipClass(customMode, status === "ok" ? "default" : "warn")}>
                <input
                  type="radio"
                  name={`${baseId}-slippage`}
                  className="sr-only"
                  checked={customMode}
                  onChange={() => {
                    setCustomMode(true);
                    customInputRef.current?.focus();
                  }}
                />
                {t("swap.slippage.custom")}
              </label>
            </div>
            <label htmlFor={`${baseId}-slippage-pct`} className="sr-only">
              {t("swap.slippage.inputLabel")}
            </label>
            <div className="relative">
              <input
                ref={customInputRef}
                id={`${baseId}-slippage-pct`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder={String(slippagePct)}
                value={customText}
                onChange={e => handleCustomChange(e.target.value)}
                aria-invalid={status === "invalid"}
                aria-describedby={statusKey ? messageId : undefined}
                className={`w-full bg-vx-surface border rounded-lg px-3 py-2 pr-7 text-sm text-vx-text placeholder-vx-dim/60 focus:outline-none transition-colors ${
                  status === "invalid"
                    ? "border-red-400/70"
                    : status === "ok"
                      ? "border-vx-border focus:border-vx-sage/50"
                      : "border-amber-400/60"
                }`}
              />
              <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-vx-muted">%</span>
            </div>
            {statusKey && (
              <p
                id={messageId}
                role={status === "invalid" ? "alert" : "status"}
                className={`text-xs ${status === "invalid" ? "text-red-400" : "text-amber-400"}`}
              >
                {t(statusKey)}
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="eyebrow mb-2">{t("swap.deadline.label")}</legend>
            <div className="flex flex-wrap gap-2">
              {DEADLINE_PRESETS_MIN.map(minutes => (
                <label key={minutes} className={chipClass(deadlineMin === minutes)}>
                  <input
                    type="radio"
                    name={`${baseId}-deadline`}
                    className="sr-only"
                    checked={deadlineMin === minutes}
                    onChange={() => setDeadlineMin(minutes)}
                  />
                  {t("swap.deadline.option", { minutes })}
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-vx-muted underline hover:text-vx-text focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage/60 rounded"
          >
            {t("swap.settings.reset")}
          </button>
        </div>
      )}
    </div>
  );
}
