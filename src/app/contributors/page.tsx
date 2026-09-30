import { Suspense } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SkeletonBlock } from "@/components/Skeleton";
import { ContributorsList } from "./ContributorsList";

interface GitHubContributor {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

const REPO_OWNER = "stellar-vortex-protocol";
const REPO_NAME = "vortex-frontend";
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contributors?per_page=100`;

async function fetchContributors(): Promise<GitHubContributor[]> {
  const res = await fetch(GITHUB_API, {
    next: { revalidate: 3600 },
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error("Failed to load contributors");
  return (await res.json()) as GitHubContributor[];
}

function ContributorsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card p-5 flex flex-col items-center gap-3 animate-pulse">
          <SkeletonBlock className="w-20 h-20 rounded-full" />
          <SkeletonBlock className="h-4 w-24 rounded" />
          <SkeletonBlock className="h-3 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

async function ContributorsContent() {
  let contributors: GitHubContributor[] = [];
  let failed = false;
  try {
    contributors = await fetchContributors();
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <div className="card p-8 text-center">
        <h2 className="text-base font-semibold text-vx-text">Couldn&apos;t load contributors</h2>
        <p className="mt-2 text-sm text-vx-muted">
          We hit a rate limit or the GitHub API is unavailable. Try again shortly.
        </p>
      </div>
    );
  }

  return <ContributorsList contributors={contributors} />;
}

export default function ContributorsPage() {
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

        <Suspense fallback={<ContributorsSkeleton />}>
          <ContributorsContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
