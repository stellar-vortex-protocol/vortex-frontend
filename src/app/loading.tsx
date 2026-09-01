import { SkeletonBlock, SkeletonCard, SkeletonText } from "@/components/Skeleton";

/**
 * Route-segment loading boundary for the home page ("/").
 * Shown by Next.js while the page component is being streamed or suspended.
 * Mirrors the two-column layout: left content column + right swap card.
 */
export default function HomeLoading() {
  return (
    <div className="min-h-screen">
      {/* Nav placeholder */}
      <div className="h-14 border-b border-vx-line" aria-hidden="true" />

      <div className="max-w-6xl mx-auto px-5 py-14">
        <div className="grid lg:grid-cols-[1fr_420px] gap-10 items-start">

          {/* Left: hero + stats + pipeline + feed */}
          <div className="space-y-10" aria-hidden="true">
            {/* Hero text */}
            <div className="space-y-3">
              <SkeletonBlock className="h-3 w-40" />
              <SkeletonBlock className="h-9 w-2/3" />
              <SkeletonBlock className="h-9 w-1/2" />
              <SkeletonText lines={2} className="mt-2 max-w-md" />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className="card-sm px-4 py-3 space-y-1">
                  <SkeletonBlock className="h-6 w-3/4" />
                  <SkeletonBlock className="h-3 w-1/2" />
                </div>
              ))}
            </div>

            {/* Pipeline */}
            <div className="space-y-3">
              <SkeletonBlock className="h-3 w-24" />
              <div className="flex items-center gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <SkeletonBlock className="w-8 h-8 rounded-full" />
                    <SkeletonBlock className="h-3 w-10" />
                  </div>
                ))}
              </div>
            </div>

            {/* Activity feed */}
            <div className="space-y-3">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonCard rows={4} rowHeight="h-14" />
            </div>
          </div>

          {/* Right: swap card skeleton */}
          <div className="card p-6 space-y-4" aria-hidden="true">
            <SkeletonBlock className="h-5 w-1/3" />
            <SkeletonBlock className="h-16 w-full" />
            <SkeletonBlock className="h-16 w-full" />
            <SkeletonBlock className="h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
