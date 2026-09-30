import { Suspense } from "react";
import AnalyticsPageClient from "./AnalyticsPageClient";

function AnalyticsSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="mx-auto w-full max-w-6xl animate-pulse space-y-6 p-4 sm:p-6"
    >
      <div className="h-8 w-56 rounded bg-white/10" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-lg bg-white/10" />
        ))}
      </div>
      <div className="h-72 rounded-lg bg-white/10" />
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsPageClient />
    </Suspense>
  );
}
