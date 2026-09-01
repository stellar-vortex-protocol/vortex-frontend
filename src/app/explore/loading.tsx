import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

/**
 * Route-segment loading boundary for /explore.
 * Mirrors the filter bar + intent table layout.
 */
export default function ExploreLoading() {
  return (
    <div className="min-h-screen">
      {/* Nav placeholder */}
      <div className="h-14 border-b border-vx-line" aria-hidden="true" />

      <div className="max-w-6xl mx-auto px-5 py-12" aria-hidden="true">
        {/* Page heading */}
        <div className="space-y-2 mb-8">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-8 w-48" />
          <SkeletonBlock className="h-4 w-72" />
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 mb-6">
          <SkeletonBlock className="h-8 w-32 rounded-lg" />
          <SkeletonBlock className="h-8 w-32 rounded-lg" />
          <SkeletonBlock className="h-8 w-40 rounded-lg" />
        </div>

        {/* Intent rows */}
        <SkeletonCard rows={8} rowHeight="h-16" />

        {/* Pagination */}
        <div className="flex justify-center gap-2 mt-6">
          <SkeletonBlock className="h-8 w-8 rounded-lg" />
          <SkeletonBlock className="h-8 w-8 rounded-lg" />
          <SkeletonBlock className="h-8 w-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
