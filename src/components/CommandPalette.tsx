"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isValidStellarPublicKey } from "@/lib/stellarAddress";

// === Static navigation targets
// The four top-level routes the palette can jump to. Keeping this list here
// (rather than deriving it from Nav) keeps the palette self-contained and
// avoids importing Nav's wallet/i18n dependencies into the global layout.
type Command = {
  id: string;
  label: string;
  hint: string;
  href: string;
};

const ROUTE_COMMANDS: Command[] = [
  { id: "route-home", label: "Swap", hint: "Home", href: "/" },
  { id: "route-explore", label: "Explore intents", hint: "/explore", href: "/explore" },
  { id: "route-solve", label: "Become a solver", hint: "/solve", href: "/solve" },
  { id: "route-my-intents", label: "My Intents", hint: "/my-intents", href: "/my-intents" },
];

// An intent id in this app is an opaque short string; treat any whitespace-free
// token of a few characters as a candidate for a direct /explore/[id] jump.
const MIN_ID_LENGTH = 3;

function truncateMiddle(value: string): string {
  return value.length <= 14 ? value : `${value.slice(0, 6)}…${value.slice(-6)}`;
}

function buildCommands(query: string): Command[] {
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();

  const routes = ROUTE_COMMANDS.filter(
    (command) =>
      lower.length === 0 ||
      command.label.toLowerCase().includes(lower) ||
      command.hint.toLowerCase().includes(lower),
  );

  if (trimmed.length === 0) return routes;

  const lookups: Command[] = [];
  if (isValidStellarPublicKey(trimmed)) {
    lookups.push({
      id: "lookup-solver",
      label: `Go to solver ${truncateMiddle(trimmed)}`,
      hint: "Solver",
      href: `/solve/${trimmed}`,
    });
  } else if (
    routes.length === 0 &&
    !trimmed.includes(" ") &&
    trimmed.length >= MIN_ID_LENGTH
  ) {
    // Only offer a direct intent-id jump when the query matches no route -
    // otherwise a plain search term like "solve" would sprout a bogus
    // "Open intent solve" row alongside the real route match.
    lookups.push({
      id: "lookup-intent",
      label: `Open intent ${truncateMiddle(trimmed)}`,
      hint: "Intent",
      href: `/explore/${trimmed}`,
    });
  }

  return [...lookups, ...routes];
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // The element focused before the palette opened, so focus can be restored on close.
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const commands = useMemo(() => buildCommands(query), [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const runCommand = useCallback(
    (command: Command | undefined) => {
      if (!command) return;
      close();
      router.push(command.href);
    },
    [close, router],
  );

  // === Global Cmd/Ctrl+K listener
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // === Focus management
  useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      inputRef.current?.focus();
    } else {
      restoreFocusRef.current?.focus?.();
    }
  }, [open]);

  // Keep the active option from drifting past the (query-dependent) list length.
  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, commands.length - 1)));
  }, [commands.length]);

  if (!open) return null;

  const activeOptionId = commands[activeIndex]?.id;

  const onListNavKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (commands.length === 0 ? 0 : (current + 1) % commands.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        commands.length === 0 ? 0 : (current - 1 + commands.length) % commands.length,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      runCommand(commands[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-vx-border bg-vx-card shadow-2xl animate-fade-up"
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-list"
          aria-activedescendant={activeOptionId}
          aria-label="Search pages, or paste an intent id or solver address"
          placeholder="Jump to a page, or paste an intent id / solver address…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onListNavKeyDown}
          className="w-full border-b border-vx-line bg-transparent px-4 py-3 text-sm text-vx-text
                     placeholder-vx-dim/60 focus:outline-none"
        />

        <ul
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          aria-label="Commands"
          className="max-h-80 overflow-y-auto py-1"
        >
          {commands.length === 0 ? (
            <li role="option" aria-selected="false" aria-disabled="true" className="px-4 py-3 text-sm text-vx-muted">
              No matches
            </li>
          ) : (
            commands.map((command, index) => (
              <li
                key={command.id}
                id={command.id}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => runCommand(command)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors ${
                  index === activeIndex ? "bg-vx-sage-bg text-vx-sage" : "text-vx-text"
                }`}
              >
                <span>{command.label}</span>
                <span className="text-[10px] uppercase tracking-wide text-vx-muted">{command.hint}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

