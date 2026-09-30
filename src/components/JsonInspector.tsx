"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { sanitizeDisplayText } from "@/lib/textSafety";

/** Children rendered per batch; larger objects/arrays reveal more on demand. */
export const JSON_PAGE_SIZE = 50;

function Primitive({ value }: { value: unknown }) {
  if (typeof value === "string") {
    // Rendered as a text node (never HTML); bidi/zero-width characters stripped.
    return <span className="text-vx-sage break-all">&quot;{sanitizeDisplayText(value)}&quot;</span>;
  }
  if (value === null || value === undefined) return <span className="text-vx-dim">null</span>;
  return <span className="text-vx-text">{String(value)}</span>;
}

function Node({ name, value, depth }: { name: string; value: unknown; depth: number }) {
  const { t } = useTranslation();
  const [limit, setLimit] = useState(JSON_PAGE_SIZE);
  const label = <span className="text-vx-muted">{sanitizeDisplayText(name)}: </span>;

  if (typeof value !== "object" || value === null) {
    return (
      <li>
        {label}
        <Primitive value={value} />
      </li>
    );
  }

  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
  const summary = Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`;
  return (
    <li>
      <details open={depth < 1}>
        <summary className="cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage">
          {label}
          <span className="text-vx-dim">{summary}</span>
        </summary>
        <ul className="pl-4 border-l border-vx-line ml-1">
          {entries.slice(0, limit).map(([k, v]) => (
            <Node key={k} name={k} value={v} depth={depth + 1} />
          ))}
          {entries.length > limit && (
            <li>
              <button
                type="button"
                onClick={() => setLimit((n) => n + JSON_PAGE_SIZE)}
                className="text-vx-sage hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage rounded"
              >
                {t("jsonInspector.showMore", { count: entries.length - limit })}
              </button>
            </li>
          )}
        </ul>
      </details>
    </li>
  );
}

/** Read-only, collapsible JSON tree for debugging payloads (#443). */
export function JsonInspector({ value, rootName = "intent" }: { value: unknown; rootName?: string }) {
  const { t } = useTranslation();
  return (
    <details className="text-xs">
      <summary className="cursor-pointer eyebrow rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage">
        {t("jsonInspector.title")}
      </summary>
      <ul aria-label={t("jsonInspector.title")} className="mt-2 font-mono num max-h-96 overflow-auto bg-vx-surface/40 rounded-lg p-3">
        <Node name={rootName} value={value} depth={0} />
      </ul>
    </details>
  );
}
