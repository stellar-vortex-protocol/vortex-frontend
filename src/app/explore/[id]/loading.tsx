import { SkeletonBlock, SkeletonDetailCard } from "@/components/Skeleton";

/**
 * Route-segment loading boundary for /explore/[id].
 * Uses SkeletonDetailCard to match the intent detail layout.
 */
export default function IntentDetailLoading() {
  return (
    <div className="min-h-screen">
      {/* Nav placeholder */}
      <div className="h-14 border-b border-vx-line" aria-hidden="true" />

      <div className="max-w-3xl mx-auto px-5 py-12" aria-hidden="true">
        {/* Back link placeholder */}
        <SkeletonBlock className="h-3 w-28 mb-6" />

        {/* Detail card */}
        <SkeletonDetailCard />

        {/* Settlement tx section */}
        <div className="mt-6 space-y-3">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
