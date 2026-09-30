import { Suspense } from "react";
import GovernancePageClient from "./GovernancePageClient";

export const metadata = {
  title: "Governance | Vortex Protocol",
  description: "Participate in Vortex protocol governance proposals and community discussions.",
};

function GovernanceSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10" aria-busy="true" aria-live="polite">
      <div className="h-8 w-56 animate-pulse rounded bg-white/10" />
      <div className="mt-3 h-4 w-80 animate-pulse rounded bg-white/10" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}

export default function GovernancePage() {
  return (
    <Suspense fallback={<GovernanceSkeleton />}>
      <GovernancePageClient />
    </Suspense>
  );
}
