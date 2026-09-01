import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

/**
 * Route-segment loading boundary for /solve.
 * Mirrors the hero + tabs + leaderboard/intents layout.
 */
export default function SolveLoading() {
  return (
    <div className="min-h-screen">
      {/* Nav placeholder */}
      <div className="h-14 border-b border-vx-line" aria-hidden="true" />

      <div className="max-w-6xl mx-auto px-5 py-12" aria-hidden="true">
        {/* Hero */}
        <div className="space-y-3 mb-10">
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="h-9 w-64" />
          <SkeletonBlock className="h-4 w-96" />
        </div>

        {/* Steps row */}
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          {Array.from({ length: 3 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="card p-5 space-y-2">
              <SkeletonBlock className="h-5 w-8" />
              <SkeletonBlock className="h-5 w-3/4" />
              <SkeletonBlock className="h-3 w-full" />
              <SkeletonBlock className="h-3 w-4/5" />
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <SkeletonBlock className="h-8 w-28 rounded-lg" />
          <SkeletonBlock className="h-8 w-24 rounded-lg" />
          <SkeletonBlock className="h-8 w-28 rounded-lg" />
        </div>

        {/* Leaderboard rows */}
        <SkeletonCard rows={5} rowHeight="h-16" />
      </div>
    </div>
  );
}
