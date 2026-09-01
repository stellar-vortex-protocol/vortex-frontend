"use client";

import { useEffect, useId, useRef, useState } from "react";

export type ComboboxItem = { key: string; label: string };

type ComboboxProps<T extends ComboboxItem> = {
  items: T[];
  value: T;
  onChange: (item: T) => void;
  ariaLabel: string;
  triggerAriaLabel?: string;
  placeholder?: string;
  noMatchesLabel: string;
  renderTrigger: (item: T, opts: { open: boolean }) => React.ReactNode;
  renderOption: (item: T, opts: { active: boolean; selected: boolean }) => React.ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
};

/** Reusable ARIA combobox/listbox: type-to-filter, roving focus, Escape/Home/End support. */
export function Combobox<T extends ComboboxItem>({
  items,
  value,
  onChange,
  ariaLabel,
  triggerAriaLabel,
  placeholder,
  noMatchesLabel,
  renderTrigger,
  renderOption,
  triggerClassName,
  panelClassName,
}: ComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const filtered = query
    ? items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : items;

  const close = () => {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(filtered.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) {
        onChange(item);
        close();
      }
    }
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={triggerAriaLabel ?? ariaLabel}
        className={triggerClassName}
      >
        {renderTrigger(value, { open })}
      </button>
      {open && (
        <div
          className={`absolute z-30 mt-1 bg-vx-card border border-vx-border rounded-xl p-2 shadow-2xl animate-fade-up ${panelClassName ?? ""}`}
        >
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={filtered[activeIndex] ? `${listboxId}-${filtered[activeIndex]!.key}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full mb-1.5 px-2.5 py-1.5 text-sm bg-vx-surface border border-vx-border rounded-md text-vx-text placeholder-vx-dim/60 focus:outline-none focus:border-vx-sage/50"
          />
          <ul
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-60 overflow-y-auto space-y-0.5"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-vx-muted">{noMatchesLabel}</li>
            )}
            {filtered.map((item, i) => (
              <li
                key={item.key}
                id={`${listboxId}-${item.key}`}
                role="option"
                aria-selected={item.key === value.key}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  onChange(item);
                  close();
                }}
                className={`cursor-pointer rounded-lg ${i === activeIndex ? "bg-vx-lav/15" : ""}`}
              >
                {renderOption(item, { active: i === activeIndex, selected: item.key === value.key })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
