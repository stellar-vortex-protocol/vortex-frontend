import { SkeletonBlock, SkeletonCard, SkeletonDetailCard } from "@/components/Skeleton";

/**
 * Route-segment loading boundary for /solve/[address].
 * Mirrors the solver detail header + fill history layout.
 */
export default function SolverProfileLoading() {
  return (
    <div className="min-h-screen">
      {/* Nav placeholder */}
      <div className="h-14 border-b border-vx-line" aria-hidden="true" />

      <div className="max-w-3xl mx-auto px-5 py-12" aria-hidden="true">
        {/* Back link placeholder */}
        <SkeletonBlock className="h-3 w-36 mb-6" />

        {/* Solver header card */}
        <SkeletonDetailCard />

        {/* Fill history section */}
        <div className="mt-8 space-y-3">
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonCard rows={6} rowHeight="h-14" />
        </div>
      </div>
    </div>
  );
}
