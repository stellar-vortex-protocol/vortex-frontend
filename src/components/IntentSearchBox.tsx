"use client";

import { useId, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { buildSuggestions, highlightSegments, MAX_QUERY_LENGTH } from "@/lib/searchQuery";
import { useRecentSearchesStore } from "@/store/recentSearches";

/** Renders `text` with matched search terms wrapped in <mark>; never injects HTML. */
export function HighlightedText({ text, terms }: { text: string; terms: readonly string[] }) {
  return (
    <>
      {highlightSegments(text, terms).map((seg, i) =>
        seg.match ? (
          <mark key={i} className="bg-vx-sage/25 text-inherit rounded-sm">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

type IntentSearchBoxProps = {
  value: string;
  onChange: (value: string) => void;
};

/**
 * Free-text + `key:value` search input with WAI-ARIA combobox semantics (#441).
 * Suggestions complete the last word to a structured token or a recent search.
 */
export function IntentSearchBox({ value, onChange }: IntentSearchBoxProps) {
  const { t } = useTranslation();
  const recent = useRecentSearchesStore((s) => s.recent);
  const addRecent = useRecentSearchesStore((s) => s.addRecent);
  const clearRecent = useRecentSearchesStore((s) => s.clearRecent);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const helpId = useId();

  const suggestions = useMemo(() => buildSuggestions(value, recent), [value, recent]);
  const expanded = open && suggestions.length > 0;
  const optionId = (i: number) => `${listboxId}-opt-${i}`;

  const choose = (next: string) => {
    onChange(next);
    setActiveIndex(-1);
    // A completed token keeps the list open for the next word; a recent search closes it.
    setOpen(next.endsWith(" "));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Don't hijack keys while an IME composition is in progress.
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (suggestions.length ? (i + 1) % suggestions.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (suggestions.length ? (i <= 0 ? suggestions.length - 1 : i - 1) : -1));
    } else if (e.key === "Enter") {
      const active = expanded ? suggestions[activeIndex] : undefined;
      if (active) {
        e.preventDefault();
        choose(active.value);
      } else {
        addRecent(value);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      if (expanded) {
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      } else if (value) {
        e.preventDefault();
        onChange("");
      }
    }
  };

  return (
    <div className="relative flex items-center gap-1">
      <label htmlFor={`${listboxId}-input`} className="sr-only">
        {t("explore.search.label")}
      </label>
      <input
        id={`${listboxId}-input`}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-describedby={helpId}
        aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        autoComplete="off"
        spellCheck={false}
        maxLength={MAX_QUERY_LENGTH}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          if (value.trim()) addRecent(value);
        }}
        onKeyDown={onKeyDown}
        placeholder={t("explore.search.placeholder")}
        className="w-64 max-w-full bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-sm text-vx-text placeholder-vx-dim/60 focus:outline-none focus:border-vx-sage/50 focus-visible:ring-2 focus-visible:ring-vx-sage transition-colors"
      />

      <details className="relative">
        <summary
          aria-label={t("explore.search.helpLabel")}
          className="list-none cursor-pointer px-2 py-1 rounded text-xs text-vx-muted hover:text-vx-text focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
        >
          ?
        </summary>
        <div className="absolute z-20 right-0 mt-2 w-72 card p-3 text-xs text-vx-muted space-y-1">
          <p className="text-vx-text font-medium">{t("explore.search.helpTitle")}</p>
          <p>{t("explore.search.helpText")}</p>
          <p className="num">status:filled · chain:base · token:USDC · &quot;exact phrase&quot;</p>
          {recent.length > 0 && (
            <button
              type="button"
              onClick={() => clearRecent()}
              className="text-vx-sage hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage rounded"
            >
              {t("explore.search.clearRecent")}
            </button>
          )}
        </div>
      </details>
      <span id={helpId} className="sr-only">
        {t("explore.search.helpText")}
      </span>

      {expanded && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={t("explore.search.suggestions")}
          className="absolute z-20 top-full left-0 mt-1 w-64 card p-1 text-sm"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.value}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              // Keep focus in the input so blur doesn't close the list first.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s.value);
              }}
              className={`flex justify-between gap-2 px-2 py-1.5 rounded cursor-pointer ${
                i === activeIndex ? "bg-vx-sage/15 text-vx-text" : "text-vx-muted"
              }`}
            >
              <span className="truncate">{s.value}</span>
              <span className="text-[10px] uppercase text-vx-dim">{t(`explore.search.kind.${s.kind}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
