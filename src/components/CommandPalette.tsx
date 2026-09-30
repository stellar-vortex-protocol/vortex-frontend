"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isValidStellarPublicKey } from "@/lib/stellarAddress";
import { GROUP_ORDER, useCommandRegistry, type CommandDefinition } from "@/lib/commands/registry";
import { rankByQuery } from "@/lib/commands/fuzzy";
import { readRecentIntents } from "@/lib/commands/recents";
import { useTranslation } from "@/lib/i18n/I18nProvider";

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

type PaletteItem = {
  id: string;
  label: string;
  hint: string;
  keywords: string[];
  group: CommandDefinition["group"];
  dangerous: boolean;
  run: () => void | Promise<void>;
  indices: number[];
};

function buildCommands(
  query: string,
  registered: CommandDefinition[],
  recents: CommandDefinition[],
  navigate: (href: string) => void,
): PaletteItem[] {
  const trimmed = query.trim();

  const routes: CommandDefinition[] = ROUTE_COMMANDS.map((command) => ({
    id: command.id,
    title: command.label,
    hint: command.hint,
    keywords: [command.hint],
    group: "Navigation",
    run: () => navigate(command.href),
  }));
  const visible = [...recents, ...routes, ...registered].filter((command) => !command.when || command.when());
  // With no query, only surface quick jumps; contextual commands appear once the user types.
  const pool =
    trimmed.length === 0
      ? visible.filter((command) => command.group === "Recent" || command.group === "Navigation")
      : visible;

  const ranked = rankByQuery(
    pool,
    trimmed,
    (command) => command.title,
    (command) => command.keywords ?? [],
  );
  // Empty query keeps registration order grouped; typed queries rank by score.
  const ordered =
    trimmed.length === 0
      ? [...ranked].sort((a, b) => GROUP_ORDER.indexOf(a.item.group) - GROUP_ORDER.indexOf(b.item.group))
      : ranked;
  const results: PaletteItem[] = ordered.map(({ item, indices }) => ({
    id: item.id,
    label: item.title,
    hint: item.hint ?? item.group,
    keywords: item.keywords ?? [],
    group: item.group,
    dangerous: item.dangerous ?? false,
    run: item.run,
    indices,
  }));

  if (trimmed.length === 0) return results;

  const lookup = (id: string, label: string, hint: string, href: string): PaletteItem => ({
    id,
    label,
    hint,
    keywords: [],
    group: "Navigation",
    dangerous: false,
    run: () => navigate(href),
    indices: [],
  });
  const lookups: PaletteItem[] = [];
  if (isValidStellarPublicKey(trimmed)) {
    lookups.push(lookup("lookup-solver", `Go to solver ${truncateMiddle(trimmed)}`, "Solver", `/solve/${trimmed}`));
  } else if (
    results.length === 0 &&
    !trimmed.includes(" ") &&
    trimmed.length >= MIN_ID_LENGTH
  ) {
    // Only offer a direct intent-id jump when the query matches no command -
    // otherwise a plain search term like "solve" would sprout a bogus
    // "Open intent solve" row alongside the real route match.
    lookups.push(lookup("lookup-intent", `Open intent ${truncateMiddle(trimmed)}`, "Intent", `/explore/${trimmed}`));
  }

  return [...lookups, ...results];
}

function Highlighted({ text, indices }: { text: string; indices: number[] }) {
  if (indices.length === 0) return <>{text}</>;
  const marked = new Set(indices);
  return (
    <>
      {Array.from(text).map((char, index) =>
        marked.has(index) ? (
          <mark key={index} className="bg-transparent font-semibold text-inherit underline">
            {char}
          </mark>
        ) : (
          <span key={index}>{char}</span>
        ),
      )}
    </>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const registry = useCommandRegistry((state) => state.commands);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // The element focused before the palette opened, so focus can be restored on close.
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const recents = useMemo<CommandDefinition[]>(
    () =>
      recentIds.map((id) => ({
        id: `recent-intent-${id}`,
        title: t("commands.recentIntent", { id: truncateMiddle(id) }),
        keywords: [id],
        group: "Recent",
        run: () => router.push(`/explore/${id}`),
      })),
    [recentIds, router, t],
  );

  const commands = useMemo(
    () => buildCommands(query, Object.values(registry), recents, (href) => router.push(href)),
    [query, registry, recents, router],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
    setConfirmId(null);
  }, []);

  const runCommand = useCallback(
    (command: PaletteItem | undefined) => {
      if (!command) return;
      if (command.dangerous && confirmId !== command.id) {
        setConfirmId(command.id);
        return;
      }
      close();
      void command.run();
    },
    [close, confirmId],
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
      setRecentIds(readRecentIntents());
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
    // Let IME composition finish before treating Enter/arrows as palette keys.
    if (event.nativeEvent.isComposing) return;
    if (event.key !== "Enter") setConfirmId(null);
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
            setConfirmId(null);
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
                <span>
                  {confirmId === command.id ? (
                    t("commands.confirm", { title: command.label })
                  ) : (
                    <Highlighted text={command.label} indices={command.indices} />
                  )}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-vx-muted">{command.hint}</span>
              </li>
            ))
          )}
        </ul>
        <div role="status" aria-live="polite" className="sr-only">
          {t("commands.resultCount", { count: commands.length })}
        </div>
      </div>
    </div>
  );
}

