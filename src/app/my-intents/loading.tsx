import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

/**
 * Route-segment loading boundary for /my-intents.
 * Mirrors the filter bar + paginated intent table layout.
 */
export default function MyIntentsLoading() {
  return (
    <div className="min-h-screen">
      {/* Nav placeholder */}
      <div className="h-14 border-b border-vx-line" aria-hidden="true" />

      <div className="max-w-6xl mx-auto px-5 py-12" aria-hidden="true">
        {/* Page heading */}
        <div className="space-y-2 mb-8">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-8 w-44" />
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap gap-3 mb-6">
          <SkeletonBlock className="h-8 w-28 rounded-lg" />
          <SkeletonBlock className="h-8 w-28 rounded-lg" />
          <SkeletonBlock className="h-8 w-36 rounded-lg" />
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
