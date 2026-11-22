"use client";

import { useMemo, useState } from "react";
import type { Contributor, ContributorsSource } from "@/lib/contributors";

const SOURCE_COPY: Record<Exclude<ContributorsSource, "live">, string> = {
  cache: "Showing the last successfully fetched contributor data because GitHub is temporarily unreachable.",
  fallback: "Showing a bundled contributor snapshot because live GitHub data is unavailable.",
};

export function ContributorsList({ contributors, source }: { contributors: Contributor[]; source: ContributorsSource }) {
  const [noticeVisible, setNoticeVisible] = useState(source !== "live");
  const [query, setQuery] = useState("");

  // Filtering is derived from the already-fetched list, so changing the filter
  // never triggers another request to /api/contributors.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return contributors;
    return contributors.filter((contributor) => contributor.login.toLowerCase().includes(needle));
  }, [contributors, query]);

  return (
    <div className="space-y-4">
      {source !== "live" && noticeVisible && (
        <div role="status" className="flex items-start justify-between gap-4 rounded-xl border border-vx-border bg-vx-surface p-4 text-sm text-vx-muted">
          <p>{SOURCE_COPY[source]}</p>
          <button type="button" aria-label="Dismiss contributor data notice" onClick={() => setNoticeVisible(false)} className="text-vx-text hover:text-vx-sage">Dismiss</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="contributor-filter" className="text-sm font-medium text-vx-text">Filter by username</label>
        <input
          id="contributor-filter"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search contributors"
          className="rounded-lg border border-vx-border bg-vx-surface px-3 py-2 text-sm text-vx-text"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {filtered.map((contributor) => (
          <a key={contributor.login} href={contributor.profileUrl} target="_blank" rel="noopener noreferrer" className="card flex flex-col items-center gap-3 p-5 text-center">
            <img src={contributor.avatarUrl} alt="" width={80} height={80} className="h-20 w-20 rounded-full" />
            <span className="text-sm font-semibold text-vx-text">{contributor.login}</span>
            <span className="text-xs text-vx-muted">{contributor.contributions} contributions</span>
          </a>
        ))}
      </div>
      {filtered.length === 0 && (
        <p role="status" className="text-sm text-vx-muted">No contributors match “{query}”.</p>
      )}
    </div>
  );
}
