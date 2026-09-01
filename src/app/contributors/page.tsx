"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SkeletonBlock } from "@/components/Skeleton";

interface GitHubContributor {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

const REPO_OWNER = "stellar-vortex-protocol";
const REPO_NAME = "vortex-frontend";
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contributors?per_page=100`;

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to load contributors");
    return res.json() as Promise<GitHubContributor[]>;
  });

function ContributorSkeleton() {
  return (
    <div className="card p-5 flex flex-col items-center gap-3 animate-pulse">
      <SkeletonBlock className="w-20 h-20 rounded-full" />
      <SkeletonBlock className="h-4 w-24 rounded" />
      <SkeletonBlock className="h-3 w-16 rounded" />
    </div>
  );
}

function ContributorCard({ contributor }: { contributor: GitHubContributor }) {
  return (
    <a
      href={contributor.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="card p-5 flex flex-col items-center gap-3 hover:border-vx-sage/40 active:bg-vx-surface/60 transition-colors group"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={contributor.avatar_url}
        alt={`${contributor.login}'s avatar`}
        className="w-20 h-20 rounded-full border-2 border-vx-border group-hover:border-vx-sage/40 transition-colors"
        loading="lazy"
      />
      <div className="text-center">
        <div className="text-sm font-semibold text-vx-text group-hover:text-vx-sage transition-colors">
          @{contributor.login}
        </div>
        <div className="text-xs text-vx-muted mt-1">
          {contributor.contributions} contribution{contributor.contributions === 1 ? "" : "s"}
        </div>
      </div>
    </a>
  );
}

export default function ContributorsPage() {
  const { data: contributors, isLoading, error } = useSWR<GitHubContributor[]>(GITHUB_API, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    dedupingInterval: 60_000,
  });

  const sorted = useMemo(() => {
    if (!contributors) return [];
    return [...contributors].sort((a, b) => a.login.localeCompare(b.login));
  }, [contributors]);

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="Contributors" />
      <main id="main-content" className="max-w-5xl mx-auto px-5 py-12">
        <div className="mb-10">
          <div className="eyebrow mb-3">Community</div>
          <h1 className="text-3xl font-bold text-vx-text mb-3">Contributors</h1>
          <p className="text-vx-muted text-sm max-w-2xl">
            Every person listed here helped build Vortex through the Drips Wave process.
            No rankings — just gratitude. Click a name to see their work on GitHub.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <ContributorSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="card p-8 text-center">
            <h2 className="text-base font-semibold text-vx-text">Couldn&apos;t load contributors</h2>
            <p className="mt-2 text-sm text-vx-muted">
              We hit a rate limit or the GitHub API is unavailable. Try again shortly.
            </p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="card p-8 text-center">
            <h2 className="text-base font-semibold text-vx-text">No contributors found</h2>
            <p className="mt-2 text-sm text-vx-muted">
              This page pulls from the GitHub repository. If you&apos;ve merged a PR, you should appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="text-xs text-vx-muted mb-4">
              {sorted.length} contributor{sorted.length === 1 ? "" : "s"} — listed alphabetically
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {sorted.map((c) => (
                <ContributorCard key={c.login} contributor={c} />
              ))}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
