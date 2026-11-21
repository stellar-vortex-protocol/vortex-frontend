"use client";

import { useState } from "react";
import useSWR from "swr";
import type { Contributor, ContributorsResponse, ContributorsSource } from "@/lib/contributors";
import { useTranslation } from "@/lib/i18n/I18nProvider";

const SOURCE_KEY = {
  live: "contributors.source.live",
  cache: "contributors.source.cache",
  fallback: "contributors.source.fallback",
} as const;

async function fetchContributors(url: string): Promise<ContributorsResponse> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`contributors request failed: ${res.status}`);
  const data = (await res.json()) as ContributorsResponse;
  if (!data || !Array.isArray(data.contributors)) throw new Error("invalid contributors payload");
  return data;
}

function ContributorAvatar({ contributor }: { contributor: Contributor }) {
  const [broken, setBroken] = useState(false);
  const initials = contributor.login.slice(0, 2).toUpperCase();
  if (broken) {
    return (
      <span
        aria-hidden="true"
        data-testid="contributor-avatar-fallback"
        className="flex h-20 w-20 items-center justify-center rounded-full bg-vx-surface text-sm font-semibold text-vx-muted"
      >
        {initials}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- avatars are remote and unoptimised by design
    <img
      src={contributor.avatarUrl}
      alt=""
      width={80}
      height={80}
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-20 w-20 rounded-full"
    />
  );
}

export function GitHubContributorsWall() {
  const { t } = useTranslation();
  const { data, error, isLoading } = useSWR<ContributorsResponse>("/api/contributors", fetchContributors, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const contributors = data?.contributors ?? [];
  const source: ContributorsSource | null = data?.source ?? null;

  return (
    <section aria-labelledby="github-contributors-heading" className="mb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="github-contributors-heading" className="text-base font-semibold text-vx-text">
          {t("contributors.wall.title")}
        </h2>
        {source && (
          <span
            data-testid="contributors-source"
            data-source={source}
            className="rounded border border-vx-border bg-vx-surface px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-vx-muted"
          >
            {t(SOURCE_KEY[source])}
          </span>
        )}
      </div>

      {isLoading && !data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card flex animate-pulse flex-col items-center gap-3 p-5">
              <span className="h-20 w-20 rounded-full bg-vx-surface" />
              <span className="h-4 w-24 rounded bg-vx-surface" />
              <span className="h-3 w-16 rounded bg-vx-surface" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && !data && (
        <p role="status" className="rounded-xl border border-vx-border bg-vx-surface p-4 text-sm text-vx-muted">
          {t("contributors.wall.unavailable")}
        </p>
      )}

      {contributors.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {contributors.map((contributor) => (
            <li key={contributor.login}>
              <a
                href={contributor.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="card flex flex-col items-center gap-3 p-5 text-center"
              >
                <ContributorAvatar contributor={contributor} />
                <span className="text-sm font-semibold text-vx-text">{contributor.login}</span>
                <span className="text-xs text-vx-muted">
                  {t("contributors.wall.contributions", { count: contributor.contributions })}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
